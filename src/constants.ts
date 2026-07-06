import { version } from "../package.json";

export const VERSION = version;
export const DASHBOARD_URL = "https://superwall.com/dashboard";

export const ENV_API_KEY = "SUPERWALL_API_KEY";

export const AUTH_HOST = process.env.SUPERWALL_AUTH_HOST ?? "https://auth.superwall.com";
export const API_HOST = process.env.SUPERWALL_API_HOST ?? "https://api.superwall.com";
// Falls back to the dashboard client until a dedicated CLI OAuth client exists.
export const CLI_CLIENT_ID = process.env.SUPERWALL_CLI_CLIENT_ID ?? "client_01KWEWM154D2T28NZAS02B8MWT";
export const OAUTH_SCOPE = "openid profile email offline_access";

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

export enum Integration {
  swift = "swift",
  expo = "expo",
  reactNative = "react-native",
  flutter = "flutter",
  web = "web",
}
