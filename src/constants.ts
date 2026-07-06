/** Product + brand constants for the Superwall wizard. */

export const PRODUCT_NAME = "Superwall";
export const WIZARD_NAME = "Superwall wizard";
export const VERSION = "0.1.0";

/** Superwall brand purple. clack/picocolors render truecolor where supported. */
export const BRAND_HEX = "#7C3AED";

export const DOCS_URL = "https://superwall.com/docs";
export const DASHBOARD_URL = "https://superwall.com/dashboard";

/** Platforms the wizard can set up today (web is detected but "coming soon"). */
export const SUPPORTED_LABEL = "iOS, Expo, React Native, or Flutter";

/** Env var an agent/CI can set to skip the interactive key prompt. */
export const ENV_API_KEY = "SUPERWALL_API_KEY";

/** OAuth issuer (OIDC discovery lives at `${AUTH_HOST}/.well-known/openid-configuration`). */
export const AUTH_HOST = process.env.SUPERWALL_AUTH_HOST ?? "https://auth.superwall.com";
/** REST API host (org key creation, /v2/me, etc.). */
export const API_HOST = process.env.SUPERWALL_API_HOST ?? "https://api.superwall.com";
/**
 * OAuth client id for the CLI. Needs a dedicated public client at
 * auth.superwall.com with the device-authorization grant enabled — set
 * SUPERWALL_CLI_CLIENT_ID once that exists. Defaults to the dashboard client.
 */
export const CLI_CLIENT_ID = process.env.SUPERWALL_CLI_CLIENT_ID ?? "client_01KWEWM154D2T28NZAS02B8MWT";
/** OIDC scopes requested during login. */
export const OAUTH_SCOPE = "openid profile email offline_access";

/**
 * Scopes the backend should grant the minted CLI key. The whole onboarding
 * pipeline needs these (plus the ASC proxy). Kept here for reference / so the
 * authorize URL can request them.
 */
export const CLI_KEY_SCOPES = [
  "projects:read",
  "projects:write",
  "applications:read",
  "applications:write",
  "paywalls:read",
  "paywalls:write",
  "campaigns:read",
  "campaigns:write",
  "products:read",
  "products:write",
  "entitlements:read",
  "entitlements:write",
  "assets:read",
  "assets:write",
  "access:read",
  "access:write",
  "data:read",
  "app_store_connect:proxy",
];

/** Supported integration targets. Keep in sync with src/core/frameworks. */
export enum Integration {
  swift = "swift",
  expo = "expo",
  reactNative = "react-native",
  flutter = "flutter",
  web = "web",
}
