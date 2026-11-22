// Explicit opt-in live test. Creates and deletes only its own temporary record.
import assert from "node:assert/strict";
import { coachGuides } from "../lib/coach-guides.ts";
import { missions } from "../lib/missions.ts";
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:3000";
const availability = await (await fetch(base + "/api/coach")).json();
assert.equal(availability.available, true, "Real AI is not configured");
const first = await fetch(base + "/api/state");
assert.equal(first.status, 200);
const cookie = first.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
const headers = {
  "Content-Type": "application/json",
  Origin: base,
  Cookie: cookie,
};
try {
  const state = {
    version: 1,
    profile: {
      experience: "기초 문법을 배웠어요",
      experienceSource: "self_reported",
      purpose: "Disposable connection test",
      purposeSource: "self_reported",
      aiConsent: true,
    },
    progress: {},
  };
  assert.equal(
    (
      await fetch(base + "/api/state", {
        method: "POST",
        headers,
        body: JSON.stringify(state),
      })
    ).status,
    200,
  );
  const mission = missions.find((m) => m.id === "ai");
  const response = await fetch(base + "/api/coach", {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      track: mission.id,
      code: mission.starter,
      level: 0,
      question: "관련 없는 문서가 나와요. 어떤 조건부터 고치면 좋을까요?",
      tests: mission.tests.map((t) => ({ label: t.label, passed: false })),
    }),
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(
    result.source,
    "ai",
    result.notice ?? "Expected a real AI response, got a prepared hint",
  );
  assert.ok(["rules", "syntax", "step", "check"].includes(result.intent));
  const selected = coachGuides(mission).find((g) => g.id === result.guideId);
  assert.ok(selected, "Expected a reviewed guide for this mission");
  assert.equal(result.message, selected.message);
  assert.ok(result.references?.length > 0);
  assert.ok(result.trace?.includes("과제 근거 대조"));
  assert.ok(result.trace?.includes("과제 조건 확인"));
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        source: result.source,
        intent: result.intent,
        trace: result.trace,
        nextAction: result.nextAction,
        message: result.message,
      },
      null,
      2,
    ),
  );
} finally {
  const deleted = await fetch(base + "/api/state", {
    method: "DELETE",
    headers,
  });
  assert.equal(deleted.status, 200, "Failed to remove disposable test fixture");
}
