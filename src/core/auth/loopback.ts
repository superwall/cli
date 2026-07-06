import { createServer } from "node:http";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";

export interface LoopbackResult {
  /** All query params the browser delivered to /callback. */
  params: Record<string, string>;
}

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Superwall</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#13151A;color:#fff;display:grid;place-items:center;height:100vh;margin:0}
.card{text-align:center}.c{color:#74FFF1;font-size:48px}h1{font-weight:600}p{color:#979797}</style></head>
<body><div class="card"><div class="c">◆</div><h1>You're logged in</h1><p>You can close this tab and return to your terminal.</p></div></body></html>`;

/**
 * Start a loopback HTTP server on 127.0.0.1, return the URL to redirect back to,
 * and a promise that resolves with the {code,state} the browser delivers.
 * The "magic come back": the browser redirect hits this server directly.
 */
export async function startLoopback(timeoutMs = 5 * 60_000): Promise<{
  redirectUri: string;
  waitForCode: Promise<LoopbackResult>;
  close: () => void;
}> {
  let resolveCode!: (r: LoopbackResult) => void;
  let rejectCode!: (e: Error) => void;
  const waitForCode = new Promise<LoopbackResult>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (params[k] = v));
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    res.end(SUCCESS_HTML);
    if (params.token || params.code || params.state) resolveCode({ params });
    else rejectCode(new Error("Empty callback"));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const timer = setTimeout(() => rejectCode(new Error("Login timed out")), timeoutMs);
  const close = () => {
    clearTimeout(timer);
    server.close();
  };
  void waitForCode.finally(close);

  const port = (server.address() as AddressInfo).port;
  return { redirectUri: `http://127.0.0.1:${port}/callback`, waitForCode, close };
}

/** Open a URL in the user's default browser (best-effort). */
export function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* user can copy the URL manually */
  }
}
