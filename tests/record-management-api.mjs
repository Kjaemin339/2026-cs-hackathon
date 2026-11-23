// Uses disposable guests only. No live AI or global cleanup is triggered.
import assert from "node:assert/strict";
import { RETENTION_MS } from "../lib/retention.ts";
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:3000";
const start = await fetch(base + "/api/state");
assert.equal(start.status, 200);
const cookie = start.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
const headers = {
  Cookie: cookie,
  Origin: base,
  "Content-Type": "application/json",
};
let freshHeaders;
try {
  const missing = await start.json();
  assert.equal(missing.state, null);
  assert.equal(missing.savedAt, null);
  assert.equal(missing.expiresAt, null);
  const state = { version: 1, profile: { aiConsent: false }, progress: {} };
  const write = await fetch(base + "/api/state", {
    method: "POST",
    headers,
    body: JSON.stringify(state),
  });
  assert.equal(write.status, 200);
  assert.equal(write.headers.get("set-cookie")?.split(";")[0], cookie);
  const receipt = await write.json();
  assert.equal(
    Date.parse(receipt.expiresAt) - Date.parse(receipt.savedAt),
    RETENTION_MS,
  );
  for (let i = 0; i < 2; i++) {
    const response = await fetch(base + "/api/state", { headers });
    const read = await response.json();
    assert.equal(read.savedAt, receipt.savedAt);
    assert.equal(read.expiresAt, receipt.expiresAt);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const other = await (await fetch(base + "/api/state")).json();
  assert.equal(other.state, null);
  assert.equal(other.savedAt, null);
  const removed = await fetch(base + "/api/state", {
    method: "DELETE",
    headers,
  });
  assert.equal(removed.status, 200);
  const freshCookie = removed.headers.get("set-cookie")?.split(";")[0];
  assert.ok(freshCookie);
  assert.notEqual(freshCookie, cookie);
  freshHeaders = { ...headers, Cookie: freshCookie };
  const stale = await fetch(base + "/api/state", {
    method: "POST",
    headers,
    body: JSON.stringify(state),
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "RECORD_DELETED");
  assert.equal(
    (await (await fetch(base + "/api/state", { headers })).json()).state,
    null,
  );
  assert.equal(
    (
      await fetch(base + "/api/state", {
        method: "POST",
        headers: freshHeaders,
        body: JSON.stringify(state),
      })
    ).status,
    200,
  );
  console.log(
    "PASS: persisted save/expiry receipts, read-only visits, isolated metadata, deletion identity rotation, stale-save rejection, fresh session saves",
  );
} finally {
  const removed = await fetch(base + "/api/state", {
    method: "DELETE",
    headers: freshHeaders ?? headers,
  });
  assert.equal(removed.status, 200);
}
