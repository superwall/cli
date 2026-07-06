import { createHash, randomBytes } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface Pkce {
  /** Secret held only by the CLI process; sent to /cli/token to prove ownership. */
  verifier: string;
  /** SHA-256(verifier), sent in the browser URL — useless without the verifier. */
  challenge: string;
  /** CSRF token echoed back on the loopback redirect. */
  state: string;
}

/** Generate a PKCE verifier/challenge pair + CSRF state for the login flow. */
export function createPkce(): Pkce {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  return { verifier, challenge, state };
}
