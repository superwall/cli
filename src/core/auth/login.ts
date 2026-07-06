import { API_HOST, AUTH_HOST, CLI_CLIENT_ID, CLI_KEY_SCOPES, OAUTH_SCOPE } from "@/constants";
import { openBrowser } from "./loopback";
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

export interface LoginOrg {
  id: number | string;
  name: string;
  role: string;
}

export interface LoginOptions {
  issuer?: string;
  apiHost?: string;
  clientId?: string;
  /** Called once we have the approval URL + user code (so the UI can show them). */
  onVerify?: (info: { url: string; userCode: string }) => void;
  onStatus?: (message: string) => void;
  /** Choose an org when the account has more than one. Omit → first org. */
  onSelectOrg?: (orgs: LoginOrg[]) => Promise<LoginOrg | null>;
  /** Prompt a brand-new user to name their first organization (registration). */
  onCreateOrg?: () => Promise<string | null>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * OAuth 2.0 Device Authorization Grant against auth.superwall.com, then mint a
 * long-lived `sk_` org key named "Superwall CLI". No loopback/redirect needed —
 * open the browser, approve, poll, done.
 */
export async function performLogin(opts: LoginOptions = {}): Promise<Session> {
  const issuer = opts.issuer ?? AUTH_HOST;
  const apiHost = opts.apiHost ?? API_HOST;
  const clientId = opts.clientId ?? CLI_CLIENT_ID;

  const disc = await discover(issuer);
  if (!disc.device_authorization_endpoint) {
    throw new Error("auth.superwall.com does not advertise a device-authorization endpoint.");
  }

  const dev = await startDeviceAuth(disc.device_authorization_endpoint, clientId);
  const url = dev.verification_uri_complete ?? dev.verification_uri;
  opts.onVerify?.({ url, userCode: dev.user_code });
  openBrowser(url);

  const { accessToken, refreshToken } = await pollForToken(disc.token_endpoint, clientId, dev, opts.onStatus);
  let apiToken = accessToken;

  // Identity + org (needed to scope the key).
  const me = (await getJson(`${apiHost}/v2/me`, apiToken).catch(() => null)) as { email?: string } | null;
  let orgList: LoginOrg[] = [];
  try {
    const res = (await getJson(`${apiHost}/v2/me/organizations`, apiToken)) as { data: LoginOrg[] };
    orgList = res.data ?? [];
  } catch {
    // A 401/empty here typically means a brand-new account with no org yet.
    orgList = [];
  }
  // Dedupe duplicate memberships; keep only orgs where we can mint a key (ADMIN+).
  const uniqueOrgs = [...new Map(orgList.map((o) => [String(o.id), o])).values()].filter(
    (o) => o.role === "OWNER" || o.role === "ADMIN",
  );

  let org: LoginOrg;
  let createdNewOrg = false;
  if (uniqueOrgs.length === 0) {
    // New account → register by creating the first organization.
    if (!opts.onCreateOrg) {
      throw new Error("Your account has no organization yet — run `superwall login` interactively to create one.");
    }
    const name = await opts.onCreateOrg();
    if (!name) throw new Error("Cancelled.");
    opts.onStatus?.("Creating your organization…");
    const created = (await postJson(`${apiHost}/v2/me/organizations`, apiToken, { name })) as {
      id: number | string;
      name: string;
    };
    org = { id: created.id, name: created.name, role: "OWNER" };
    createdNewOrg = true;
  } else if (uniqueOrgs.length === 1 || !opts.onSelectOrg) {
    org = uniqueOrgs[0]!;
  } else {
    const picked = await opts.onSelectOrg(uniqueOrgs);
    if (!picked) throw new Error("No organization selected.");
    org = picked;
  }

  // The API caches the auth context for 60s keyed by the token. Since we just
  // created the org, that cached context predates the membership — refresh the
  // token (new key) so the key-mint sees the new org immediately.
  if (createdNewOrg && refreshToken) {
    opts.onStatus?.("Activating your organization…");
    const fresh = await refreshAccessToken(disc.token_endpoint, clientId, refreshToken);
    if (fresh) apiToken = fresh;
  }

  // Mint the long-lived CLI key.
  opts.onStatus?.("Creating your Superwall CLI key…");
  const token = await createCliKey(apiHost, org.id, apiToken);

  const session: Session = {
    apiKey: token,
    orgId: String(org.id),
    orgName: org.name,
    orgCount: createdNewOrg ? 1 : uniqueOrgs.length,
    userEmail: me?.email,
    host: apiHost,
    createdAt: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}

async function discover(issuer: string): Promise<Discovery> {
  const r = await fetch(`${issuer}/.well-known/openid-configuration`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`OIDC discovery failed (HTTP ${r.status}).`);
  return (await r.json()) as Discovery;
}

async function startDeviceAuth(endpoint: string, clientId: string): Promise<DeviceAuth> {
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
): Promise<{ accessToken: string; refreshToken?: string }> {
  const deadline = Date.now() + (dev.expires_in ?? 600) * 1000;
  let interval = dev.interval ?? 5;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: DEVICE_GRANT, device_code: dev.device_code, client_id: clientId }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };
    if (r.ok && d.access_token) return { accessToken: d.access_token, refreshToken: d.refresh_token };
    switch (d.error) {
      case "authorization_pending":
        onStatus?.("Waiting for you to approve in the browser…");
        continue;
      case "slow_down":
        interval += 5;
        continue;
      case "expired_token":
        throw new Error("The login request expired — run `superwall login` again.");
      case "access_denied":
        throw new Error("Login was denied.");
      default:
        throw new Error(d.error_description || d.error || "Token polling failed.");
    }
  }
  throw new Error("Login timed out.");
}

async function createCliKey(apiHost: string, orgId: number | string, accessToken: string): Promise<string> {
  // A just-created org can lag the 60s auth-context cache — retry the
  // membership error a few times so onboarding doesn't fail on a race.
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${apiHost}/v2/organizations/${orgId}/access/api-keys`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: "Superwall CLI",
        scopes: CLI_KEY_SCOPES,
        project_access_mode: "ALL_PROJECTS",
        project_ids: [],
      }),
    });
    if (r.ok) {
      const key = (await r.json()) as { token?: string };
      if (!key.token) throw new Error("Key creation did not return a token.");
      return key.token;
    }
    const detail = await r.text().catch(() => "");
    const membershipLag = r.status === 400 && /not a member|parameter_invalid/i.test(detail);
    if (membershipLag && attempt < 4) {
      await sleep(2500);
      continue;
    }
    throw new Error(`Creating the CLI key failed (HTTP ${r.status}). ${detail}`.trim());
  }
  throw new Error("Creating the CLI key failed after retries.");
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
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId }),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { access_token?: string };
    return d.access_token ?? null;
  } catch {
    return null;
  }
}

async function getJson(url: string, accessToken: string): Promise<unknown> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  if (!r.ok) throw new Error(`GET ${url} failed (HTTP ${r.status}).`);
  return r.json();
}

async function postJson(url: string, accessToken: string, body: unknown): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`POST ${url} failed (HTTP ${r.status}). ${detail}`.trim());
  }
  return r.json();
}
