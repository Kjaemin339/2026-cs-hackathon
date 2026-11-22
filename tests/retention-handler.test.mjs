import test from "node:test";
import assert from "node:assert/strict";
import { cleanupRequest } from "../lib/retention-handler.ts";
const secret = "disposable-test-token-at-least-32-chars";
const request = (token) =>
  new Request("https://test.local/api/cron/retention", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
test("scheduled cleanup requires the configured secret before accessing any storage", async () => {
  let calls = 0;
  const storage = async () => {
    calls++;
    throw new Error("must not access");
  };
  for (const configured of [undefined, "short"])
    assert.equal(
      (await cleanupRequest(request(secret), configured, storage)).status,
      503,
    );
  for (const token of [null, "wrong", secret.slice(0, -1) + "x"])
    assert.equal(
      (await cleanupRequest(request(token), secret, storage)).status,
      401,
    );
  assert.equal(calls, 0);
});
test("authorized cleanup returns only aggregate counts and surfaces failures without leaking details", async () => {
  const response = await cleanupRequest(request(secret), secret, async () => ({
    cleanup: async () => ({ states: 4, calls: 8, usage: 2 }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    deleted: { states: 4, calls: 8, usage: 2 },
  });
  const failed = await cleanupRequest(request(secret), secret, async () => {
    throw new Error("sensitive database location");
  });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "Cleanup failed" });
});
