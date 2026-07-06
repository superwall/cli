import { API_HOST } from "@/constants";
import { loadSession, type Session } from "@/core/auth/storage";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
  }
}

export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run `superwall login` first.");
  }
}

/** A typed-ish client over the Superwall REST API, authenticated by the session. */
export class SuperwallApi {
  private constructor(private readonly session: Session) {}

  /** Construct from an explicit session (used by tests + fromSession). */
  static of(session: Session): SuperwallApi {
    return new SuperwallApi(session);
  }

  /** Build from the stored session, or throw NotLoggedInError. */
  static fromSession(): SuperwallApi {
    const session = loadSession();
    if (!session) throw new NotLoggedInError();
    return new SuperwallApi(session);
  }

  get org(): { id?: string; name?: string; count: number } {
    return { id: this.session.orgId, name: this.session.orgName, count: this.session.orgCount ?? 1 };
  }
  get userEmail(): string | undefined {
    return this.session.userEmail;
  }

  private base(): string {
    return this.session.host || API_HOST;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base()}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.session.apiKey}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`${method} ${path} → HTTP ${res.status}`, res.status, text);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }
  del<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Paginate a cursor-based `{ data, has_more }` list endpoint and return all rows.
   * (The API caps `limit` at 100.)
   */
  async list<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let after: string | undefined;
    for (let i = 0; i < 50; i++) {
      const sep = path.includes("?") ? "&" : "?";
      const url = `${path}${sep}limit=100${after ? `&starting_after=${after}` : ""}`;
      const page = await this.get<{ data: T[]; has_more?: boolean }>(url);
      out.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      const last = page.data[page.data.length - 1] as { id?: string | number };
      if (last?.id == null) break;
      after = String(last.id);
    }
    return out;
  }
}
