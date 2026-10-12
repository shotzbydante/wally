/**
 * Supabase, used only as a Postgres database and only from the server.
 * Every call goes to one of the functions in supabase/migrations, through
 * the project's REST endpoint, with the secret key. The key never reaches
 * the browser.
 */
export interface DbConfig {
  url: string;
  key: string;
}

export function dbConfig(): DbConfig | null {
  // Supabase's dashboard shows the URL with /rest/v1 on the end; accept either form.
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  // The Vercel integration names the key SUPABASE_SERVICE_ROLE_KEY.
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return url && key ? { url, key } : null;
}

export const dbConfigured = () => dbConfig() !== null;

export class DbError extends Error {}

/** Calls a database function. Throws DbError if it can't be reached or refuses. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const config = dbConfig();
  if (!config) throw new DbError("database not configured");
  let res: Response;
  try {
    res = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (cause) {
    console.error(`[db] ${fn}: no response`, cause instanceof Error ? cause.name : "");
    throw new DbError(`${fn}: no response`);
  }
  if (!res.ok) {
    // The body names the cause (wrong key, function missing) and holds no secrets.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`[db] ${fn}: ${res.status} ${detail}`);
    throw new DbError(`${fn}: ${res.status}`);
  }
  return (await res.json()) as T;
}
