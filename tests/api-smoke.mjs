import assert from "node:assert/strict";
import { normalizeLabState } from "../lib/lab-state.ts";
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:3000";
const first = await fetch(base + "/api/state");
assert.equal(first.status, 200);
const cookie = first.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
assert.equal((await first.json()).state, null);
const state = {
  version: 1,
  profile: {
    experience: "QA fixture",
    purpose: "API isolation test",
    aiConsent: false,
  },
  progress: {},
};
const headers = {
  "Content-Type": "application/json",
  Origin: base,
  Cookie: cookie,
};
const write = await fetch(base + "/api/state", {
  method: "POST",
  headers,
  body: JSON.stringify(state),
});
assert.equal(write.status, 200);
assert.deepEqual(
  (
    await (
      await fetch(base + "/api/state", { headers: { Cookie: cookie } })
    ).json()
  ).state,
  normalizeLabState(state),
);
assert.equal((await (await fetch(base + "/api/state")).json()).state, null);
assert.equal(
  (
    await fetch(base + "/api/state", {
      method: "POST",
      headers: { ...headers, Origin: "https://other.example" },
      body: JSON.stringify(state),
    })
  ).status,
  403,
);
assert.equal(
  (
    await fetch(base + "/api/state", {
      method: "POST",
      headers,
      body: '{"version":1}',
    })
  ).status,
  400,
);
// Explicit answers and their execution evidence survive the actual storage round trip.
const answered = {
  ...state,
  profile: {
    experience: "작은 프로젝트를 해봤어요",
    experienceSource: "self_reported",
    purpose: null,
    purposeSource: "unknown",
    aiConsent: false,
  },
};
assert.equal(
  (
    await fetch(base + "/api/state", {
      method: "POST",
      headers,
      body: JSON.stringify(answered),
    })
  ).status,
  200,
);
const restored = (
  await (
    await fetch(base + "/api/state", { headers: { Cookie: cookie } })
  ).json()
).state;
assert.equal(restored.profile.experienceSource, "self_reported");
assert.equal(restored.profile.experience, "작은 프로젝트를 해봤어요");
assert.equal(restored.profile.purpose, null);
const coach = await fetch(base + "/api/coach", {
  method: "POST",
  headers,
  body: JSON.stringify({
    track: "frontend",
    code: "function selectEvents(){return []}",
    level: 0,
    question: "어떻게 시작하나요?",
    tests: [],
  }),
});
assert.equal(coach.status, 200);
assert.equal((await coach.json()).source, "guide");
assert.equal(
  (await fetch(base + "/api/state", { method: "DELETE", headers })).status,
  200,
);
assert.equal(
  (
    await (
      await fetch(base + "/api/state", { headers: { Cookie: cookie } })
    ).json()
  ).state,
  null,
);
console.log(
  "PASS: persistence, guest isolation, origin checks, validation, coach fallback, fixture deletion",
);
