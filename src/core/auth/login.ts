import { API_HOST, AUTH_HOST, CLI_CLIENT_ID, OAUTH_SCOPE } from "@/constants";
import { openBrowser } from "./browser";
import { saveSession, type Session } from "./storage";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

interface Discovery {
  token_endpoint: string;
  device_authorization_endpoint?: string;
}

interface DeviceAuth {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  interval?: number;
  expires_in?: number;
}

interface LoginOrg {
  id: number | string;
  name: string;
}

export interface LoginOptions {
  issuer?: string;
  apiHost?: string;
  clientId?: string;
  onVerify?: (info: { url: string; userCode: string }) => void;
  onStatus?: (message: string) => void;
  onCreateOrg?: () => Promise<string | null>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function performLogin(opts: LoginOptions = {}): Promise<Session> {
  const issuer = opts.issuer ?? AUTH_HOST;
  const apiHost = opts.apiHost ?? API_HOST;
  const clientId = opts.clientId ?? CLI_CLIENT_ID;

  const disc = await discover(issuer);
  if (!disc.device_authorization_endpoint) {
    throw new Error(
      "auth.superwall.com does not advertise a device-authorization endpoint.",
    );
  }

  const dev = await startDeviceAuth(
    disc.device_authorization_endpoint,
    clientId,
  );
  const url = dev.verification_uri_complete ?? dev.verification_uri;
  opts.onVerify?.({ url, userCode: dev.user_code });
  openBrowser(url);

  const { accessToken, refreshToken, expiresIn } = await pollForToken(
    disc.token_endpoint,
    clientId,
    dev,
    opts.onStatus,
  );
  let apiToken = accessToken;

  const me = (await getJson(`${apiHost}/v2/me`, apiToken).catch(
    () => null,
  )) as { email?: string } | null;
  let orgList: LoginOrg[] = [];
  try {
    const res = (await getJson(`${apiHost}/v2/me/organizations`, apiToken)) as {
      data: LoginOrg[];
    };
    orgList = res.data ?? [];
  } catch {
    // A brand-new account has no org yet.
    orgList = [];
  }
  const uniqueOrgs = [
    ...new Map(orgList.map((o) => [String(o.id), o])).values(),
  ];

  // The token is user-scoped, so login only records an org when it's unambiguous.
  // Multi-org accounts pick one lazily (requireOrg) at the first org-scoped command.
  let org: LoginOrg | undefined;
  let createdNewOrg = false;
  if (uniqueOrgs.length === 0) {
    if (!opts.onCreateOrg) {
      throw new Error(
        "Your account has no organization yet - run `superwall login` interactively to create one.",
      );
    }
    const name = await opts.onCreateOrg();
    if (!name) throw new Error("Cancelled.");
    opts.onStatus?.("Creating your organization…");
    const created = (await postJson(
      `${apiHost}/v2/me/organizations`,
      apiToken,
      { name },
    )) as {
      id: number | string;
      name: string;
    };
    org = { id: created.id, name: created.name };
    createdNewOrg = true;
  } else if (uniqueOrgs.length === 1) {
    org = uniqueOrgs[0]!;
  }

  // The API caches auth context for 60s per token; refresh so the key-mint sees the new org.
  if (createdNewOrg && refreshToken) {
    opts.onStatus?.("Activating your organization…");
    const fresh = await refreshAccessToken(
      disc.token_endpoint,
      clientId,
      refreshToken,
    );
    if (fresh) apiToken = fresh;
  }

  const session: Session = {
    authMethod: "oauth",
    orgId: org ? String(org.id) : undefined,
    orgName: org?.name,
    orgCount: createdNewOrg ? 1 : uniqueOrgs.length,
    userEmail: me?.email,
    host: apiHost,
    createdAt: new Date().toISOString(),
    accessToken: apiToken,
    refreshToken,
    accessTokenExpiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    tokenEndpoint: disc.token_endpoint,
    oauthClientId: clientId,
  };
  saveSession(session);
  return session;
}

export async function loginWithApiKey(
  apiKey: string,
  apiHost = API_HOST,
): Promise<Session> {
  const key = apiKey.trim();
  if (!key) throw new Error("An API key is required.");

  let org: { id?: string; name?: string } = {};
  try {
    const res = (await getJson(`${apiHost}/v2/me/organizations`, key)) as {
      data?: Array<{ id: number | string; name: string }>;
    };
    const first = res.data?.[0];
    if (first) org = { id: String(first.id), name: first.name };
  } catch {
    throw new Error("That API key was rejected. Check it and try again.");
  }

  const session: Session = {
    authMethod: "api_key",
    apiKey: key,
    orgId: org.id,
    orgName: org.name,
    host: apiHost,
    createdAt: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}

async function discover(issuer: string): Promise<Discovery> {
  const r = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { accept: "application/json" },
  });
  if (!r.ok) throw new Error(`OIDC discovery failed (HTTP ${r.status}).`);
  return (await r.json()) as Discovery;
}

async function startDeviceAuth(
  endpoint: string,
  clientId: string,
): Promise<DeviceAuth> {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope: OAUTH_SCOPE }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(
      `Device authorization failed (HTTP ${r.status}). Register a CLI OAuth client with the device grant. ${detail}`.trim(),
    );
  }
  return (await r.json()) as DeviceAuth;
}

async function pollForToken(
  tokenEndpoint: string,
  clientId: string,
  dev: DeviceAuth,
  onStatus?: (m: string) => void,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const deadline = Date.now() + (dev.expires_in ?? 600) * 1000;
  let interval = dev.interval ?? 5;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: DEVICE_GRANT,
        device_code: dev.device_code,
        client_id: clientId,
      }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (r.ok && d.access_token)
      return {
        accessToken: d.access_token,
        refreshToken: d.refresh_token,
        expiresIn: d.expires_in,
      };
    switch (d.error) {
      case "authorization_pending":
        onStatus?.("Waiting for you to approve in the browser…");
        continue;
      case "slow_down":
        interval += 5;
        continue;
      case "expired_token":
        throw new Error(
          "The login request expired - run `superwall login` again.",
        );
      case "access_denied":
        throw new Error("Login was denied.");
      default:
        throw new Error(
          d.error_description || d.error || "Token polling failed.",
        );
    }
  }
  throw new Error("Login timed out.");
}

async function refreshAccessToken(
  tokenEndpoint: string,
  clientId: string,
  refreshToken: string,
): Promise<string | null> {
  try {
    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { access_token?: string };
    return d.access_token ?? null;
  } catch {
    return null;
  }
}

async function getJson(url: string, accessToken: string): Promise<unknown> {
  const r = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  if (!r.ok) throw new Error(`GET ${url} failed (HTTP ${r.status}).`);
  return r.json();
}

async function postJson(
  url: string,
  accessToken: string,
  body: unknown,
): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`POST ${url} failed (HTTP ${r.status}). ${detail}`.trim());
  }
  return r.json();
}
