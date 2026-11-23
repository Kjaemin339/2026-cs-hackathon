// Destructive cleanup verification is restricted to an explicitly selected local SQLite QA database.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const base = process.env.LAB_TEST_URL;
const dbPath = process.env.LAB_RETENTION_TEST_DB;
if (
  !base ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname) ||
  !dbPath ||
  !process.env.CRON_SECRET
)
  throw new Error(
    "Explicit local QA URL, SQLite path and test cron secret required",
  );
const db = new DatabaseSync(dbPath);
const prefix = "retention-qa-" + crypto.randomUUID();
const cutoff = Date.now() - 31 * 86400000;
const oldQuota = new Date(cutoff).toISOString().slice(0, 10) + ":" + prefix;
const stateCount = () =>
  db
    .prepare("SELECT count(*) AS n FROM lab_states WHERE owner_key=?")
    .get(prefix).n;
try {
  db.prepare("INSERT INTO lab_states VALUES (?,?,?)").run(
    prefix,
    '{"version":1,"progress":{}}',
    cutoff,
  );
  db.prepare("INSERT INTO ai_calls VALUES (?,?,?,?,?,?,?,?)").run(
    prefix,
    prefix,
    "test",
    1,
    1,
    1,
    "ok",
    cutoff,
  );
  db.prepare("INSERT INTO ai_usage VALUES (?,?)").run(oldQuota, 1);
  const unauthorized = await fetch(base + "/api/cron/retention");
  assert.equal(unauthorized.status, 401);
  assert.equal(stateCount(), 1);
  const cleanup = await fetch(base + "/api/cron/retention", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert.equal(cleanup.status, 200);
  const counts = (await cleanup.json()).deleted;
  assert.ok(counts.states >= 1 && counts.calls >= 1 && counts.usage >= 1);
  assert.equal(stateCount(), 0);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM ai_calls WHERE id=?").get(prefix).n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM ai_usage WHERE key=?").get(oldQuota)
      .n,
    0,
  );
  console.log(
    "PASS: scheduled endpoint authentication and unattended expired state/call/quota cleanup in isolated SQLite",
  );
} finally {
  db.prepare("DELETE FROM lab_states WHERE owner_key=?").run(prefix);
  db.prepare("DELETE FROM ai_calls WHERE id=?").run(prefix);
  db.prepare("DELETE FROM ai_usage WHERE key=?").run(oldQuota);
  db.close();
}
