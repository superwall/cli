/**
 * Stripe/httpie-style `-d key=value` params → a nested JSON object.
 *
 * Because our JSON API is typed (some fields want strings, others numbers),
 * values are strings by default and you opt into a typed value with `:=`:
 *
 *   identifier=com.app.pro          → { identifier: "com.app.pro" }   (string)
 *   project_id=25607                → { project_id: "25607" }         (string)
 *   price[amount]:=4999             → { price: { amount: 4999 } }      (number)
 *   subscription[trial_period_days]:=7
 *   active:=true                    → { active: true }
 *   entitlements[0]=ent_123         → { entitlements: ["ent_123"] }
 *   items[0][price]=price_1         → { items: [{ price: "price_1" }] }
 */
export function parseParams(pairs: string[] | undefined): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const pair of pairs ?? []) {
    const eq = pair.indexOf("=");
    if (eq < 0) throw new Error(`Invalid -d "${pair}" — expected key=value (or key:=jsonValue).`);

    const typed = pair[eq - 1] === ":"; // `key:=value` → parse value as JSON
    const key = pair.slice(0, typed ? eq - 1 : eq);
    const raw = pair.slice(eq + 1);
    const value = typed ? parseTyped(raw, pair) : raw;

    setPath(root, splitKey(key), value);
  }
  return root;
}

function parseTyped(raw: string, pair: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid -d "${pair}" — value after := must be JSON (number, true/false, null, "quoted", [...], {...}).`);
  }
}

/** `items[0][price]` → ["items", "0", "price"]. */
function splitKey(key: string): string[] {
  return key
    .replace(/\]/g, "")
    .split("[")
    .filter((p) => p !== "");
}

function setPath(root: Record<string, unknown>, parts: string[], value: unknown): void {
  let cur: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!;
    if (i === parts.length - 1) {
      assign(cur, key, value);
      return;
    }
    const nextIsIndex = /^\d+$/.test(parts[i + 1]!);
    let next = get(cur, key);
    if (next === undefined) {
      next = nextIsIndex ? [] : {};
      assign(cur, key, next);
    }
    cur = next as Record<string, unknown> | unknown[];
  }
}

function get(container: Record<string, unknown> | unknown[], key: string): unknown {
  return Array.isArray(container) ? container[Number(key)] : container[key];
}

function assign(container: Record<string, unknown> | unknown[], key: string, value: unknown): void {
  if (Array.isArray(container)) container[Number(key)] = value;
  else container[key] = value;
}
