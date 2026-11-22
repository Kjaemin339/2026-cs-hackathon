import test from "node:test";
import assert from "node:assert/strict";
import { requestCoach } from "../lib/coach-request.ts";
import { DeadlineExceeded } from "../lib/async-deadline.ts";
const input = {
  track: "frontend",
  code: "function selectEvents(){return []}",
  question: "help",
  level: 0,
  tests: [],
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const options = () => ({
  state: { version: 1, progress: {} },
  waitForSave: Promise.resolve(),
  signal: new AbortController().signal,
  timeoutMs: 80,
});
test("the total deadline includes a stalled save queue and prevents later requests", async () => {
  const gate = deferred();
  let calls = 0;
  const pending = requestCoach(input, {
    ...options(),
    waitForSave: gate.promise,
    timeoutMs: 20,
    fetcher: async () => {
      calls++;
      return Response.json({});
    },
  });
  await assert.rejects(pending, DeadlineExceeded);
  gate.resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 0);
});
test("canceling for a basic hint rejects even when the provider ignores abort and replies late", async () => {
  const gate = deferred(),
    entered = deferred(),
    controller = new AbortController();
  let applied = 0,
    signal;
  const pending = requestCoach(input, {
    ...options(),
    signal: controller.signal,
    fetcher: async (url, o) => {
      if (url === "/api/state") return Response.json({});
      signal = o.signal;
      entered.resolve();
      return gate.promise;
    },
  }).then((x) => {
    applied++;
    return x;
  });
  await entered.promise;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(signal.aborted, true);
  gate.resolve(Response.json({ source: "ai", message: "late" }));
  await new Promise((r) => setImmediate(r));
  assert.equal(applied, 0);
});
test("one deadline covers state persistence, provider request and JSON parsing", async () => {
  const calls = [];
  const reply = await requestCoach(input, {
    ...options(),
    fetcher: async (url, o) => {
      calls.push({ url, signal: o.signal, body: JSON.parse(o.body) });
      return Response.json(
        url === "/api/state"
          ? {}
          : { source: "ai", message: "next step", trace: ["과제 조건 확인"] },
      );
    },
  });
  assert.equal(reply.source, "ai");
  assert.equal(calls[0].url, "/api/state");
  assert.equal(calls[1].url, "/api/coach");
  assert.equal(calls[0].signal, calls[1].signal);
  assert.deepEqual(calls[1].body, input);
});
test("a hanging save request times out before contacting the AI endpoint", async () => {
  let calls = 0;
  await assert.rejects(
    requestCoach(input, {
      ...options(),
      timeoutMs: 20,
      fetcher: async () => {
        calls++;
        return new Promise(() => {});
      },
    }),
    DeadlineExceeded,
  );
  assert.equal(calls, 1);
});
