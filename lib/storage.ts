import { neon } from "@neondatabase/serverless";
import type { LabState } from "./missions";

type SavedState = { state: LabState; updatedAt: number };
export interface LabStorage {
  read(owner: string): Promise<SavedState | null>;
  save(owner: string, state: LabState): Promise<void>;
  remove(owner: string): Promise<void>;
  reserve(owner: string, track: string): Promise<boolean>;
  logUsage(entry: {
    owner: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    outcome: string;
  }): Promise<void>;
}

const TTL = 30 * 86400000;
type Query = (
  text: string,
  values: unknown[],
) => Promise<Record<string, unknown>[]>;

export function createStorage(query: Query): LabStorage {
  return {
    async read(owner) {
      const [row] = await query(
        "SELECT state,updated_at FROM lab_states WHERE owner_key=$1",
        [owner],
      );
      if (!row) return null;
      if (Number(row.updated_at) < Date.now() - TTL) {
        await query("DELETE FROM lab_states WHERE owner_key=$1", [owner]);
        return null;
      }
      return {
        state: (typeof row.state === "string"
          ? JSON.parse(row.state)
          : row.state) as LabState,
        updatedAt: Number(row.updated_at),
      };
    },
    async save(owner, state) {
      await query(
        "INSERT INTO lab_states(owner_key,state,updated_at) VALUES ($1,$2,$3) ON CONFLICT(owner_key) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at",
        [owner, JSON.stringify(state), Date.now()],
      );
      await query(
        "DELETE FROM lab_states WHERE owner_key IN (SELECT owner_key FROM lab_states WHERE updated_at < $1 LIMIT 100)",
        [Date.now() - TTL],
      );
    },
    async remove(owner) {
      await query("DELETE FROM lab_states WHERE owner_key=$1", [owner]);
    },
    async reserve(owner, track) {
      const day = new Date().toISOString().slice(0, 10);
      const reserve = async (key: string, limit: number) =>
        (
          await query(
            "INSERT INTO ai_usage(key,count) VALUES ($1,1) ON CONFLICT(key) DO UPDATE SET count=ai_usage.count+1 WHERE ai_usage.count < $2 RETURNING count",
            [day + ":" + key, limit],
          )
        ).length > 0;
      // Conditional upserts enforce each cap even across parallel serverless instances.
      if (!(await reserve(owner, 22))) return false;
      if (!(await reserve(owner + ":" + track, 6))) return false;
      return reserve("global", 200);
    },
    async logUsage(e) {
      await query(
        "INSERT INTO ai_calls(id,owner_key,model,input_tokens,output_tokens,latency_ms,outcome,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          crypto.randomUUID(),
          e.owner,
          e.model,
          e.inputTokens,
          e.outputTokens,
          e.latencyMs,
          e.outcome,
          Date.now(),
        ],
      );
    },
  };
}

let cached: LabStorage | undefined;
export async function getStorage(): Promise<LabStorage> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (url) {
    const sql = neon(url);
    cached = createStorage(
      (text, values) =>
        sql.query(text, values, {
          fetchOptions: { signal: AbortSignal.timeout(6000) },
        }) as Promise<Record<string, unknown>[]>,
    );
    return cached;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("DATABASE_NOT_CONFIGURED");
  // Local development only. A serverless deployment must have durable storage.
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");
  const path = process.env.LAB_SQLITE_PATH ?? resolve(".local/lab.sqlite");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE IF NOT EXISTS lab_states(owner_key TEXT PRIMARY KEY,state TEXT NOT NULL,updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS ai_usage(key TEXT PRIMARY KEY,count INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS ai_calls(id TEXT PRIMARY KEY,owner_key TEXT NOT NULL,model TEXT NOT NULL,input_tokens INTEGER NOT NULL,output_tokens INTEGER NOT NULL,latency_ms INTEGER NOT NULL,outcome TEXT NOT NULL,created_at INTEGER NOT NULL);",
  );
  cached = createStorage(async (text, values) => {
    const sqlite = text.replace(/\$\d+/g, "?");
    const statement = db.prepare(sqlite);
    return statement.all(...(values as (string | number | null)[])) as Record<
      string,
      unknown
    >[];
  });
  return cached;
}
