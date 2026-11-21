import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createStorage } from "../lib/storage.ts";
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const store = createStorage(async (text, values) =>
    db.prepare(text.replace(/\$\d+/g, "?")).all(...values),
  );
  return { db, store };
}
test("records are isolated, updated, expired, and removed by owner", async () => {
  const { store, db } = fixture(),
    state = { version: 1, progress: {} };
  await store.save("a", state);
  assert.deepEqual((await store.read("a")).state, state);
  assert.equal(await store.read("b"), null);
  await store.save("b", state);
  await store.remove("a");
  assert.equal(await store.read("a"), null);
  assert.ok(await store.read("b"));
  db.prepare("UPDATE lab_states SET updated_at=? WHERE owner_key=?").run(
    Date.now() - 31 * 86400000,
    "b",
  );
  assert.equal(await store.read("b"), null);
  db.close();
});
test("per-role cap rejects a seventh request and keeps other roles available", async () => {
  const { store, db } = fixture();
  for (let i = 0; i < 6; i++)
    assert.equal(await store.reserve("a", "ai"), true);
  assert.equal(await store.reserve("a", "ai"), false);
  assert.equal(await store.reserve("a", "cloud"), true);
  db.close();
});
test("global cap is shared by independent users and survives new storage objects", async () => {
  const { store, db } = fixture();
  for (let i = 0; i < 200; i++)
    assert.equal(await store.reserve("guest-" + i, "ai"), true);
  assert.equal(await store.reserve("new-guest", "ai"), false);
  db.close();
});
