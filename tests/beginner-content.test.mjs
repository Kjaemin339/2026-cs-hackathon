import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  missions,
  initialProgress,
  LEGACY_CONTENT_VERSION,
  missionById,
} from "../lib/missions.ts";
import { missionForProgress } from "../lib/mission-catalog.ts";
import { releaseMissions as old } from "../lib/content/2026-11-23.1.ts";
import {
  changeCode,
  snapshotExecution,
  canRecordAttempt,
} from "../lib/lab-state.ts";
const run = (m, code, args) =>
  JSON.parse(
    JSON.stringify(
      vm.runInNewContext(
        code + `; ${m.fn}(...input)`,
        { input: structuredClone(args) },
        { timeout: 300 },
      ),
    ),
  );
const fixes = {
  frontend: [
    "if (availableOnly && !hasRoom) return true;",
    "if (availableOnly && !hasRoom) return false;",
  ],
  backend: ["attendees.length > capacity", "attendees.length >= capacity"],
  data: [
    "rate: 0",
    "rate: Math.round(groups[category].attended / groups[category].total * 100)",
  ],
  ai: ["filter(doc => doc.score >= 0)", "filter(doc => doc.score > 0)"],
  security: [
    "user.role === 'admin'",
    "user.role === 'admin' && action === 'read'",
  ],
  cloud: [
    "errorRate > 0.02 && metrics.p95Ms > 500",
    "errorRate > 0.02 || metrics.p95Ms > 500",
  ],
};
for (const m of missions) {
  test(`${m.id}: a single-line edit solves all five unchanged role scenarios`, async () => {
    const previous = old.find((x) => x.id === m.id),
      [from, to] = fixes[m.id];
    assert.notEqual(m.contentVersion, LEGACY_CONTENT_VERSION);
    assert.ok(m.starter.includes("TODO"));
    assert.ok(m.starter.includes(m.practice.focus));
    assert.ok(m.starter.includes(from));
    assert.equal(m.tests.length, 5);
    assert.deepEqual(m.tests, previous.tests);
    assert.deepEqual(m.steps, previous.steps);
    assert.deepEqual(m.guides, previous.guides);
    assert.deepEqual(m.hints, previous.hints);
    assert.equal(m.solution, previous.solution);
    assert.ok(
      m.tests.some(
        (t) =>
          JSON.stringify(run(m, m.starter, t.args)) !==
          JSON.stringify(t.expected),
      ),
    );
    const edited = m.starter.replace(from, to);
    assert.equal(edited.split("\n").length, m.starter.split("\n").length);
    for (const scenario of m.tests)
      assert.deepEqual(
        run(m, edited, scenario.args),
        scenario.expected,
        scenario.label,
      );
    const p = {
      ...initialProgress(m),
      ...changeCode(initialProgress(m), edited, "user"),
    };
    p.lastExecution = await snapshotExecution(p, m, {
      tests: [],
      preview: null,
    });
    assert.equal(canRecordAttempt(p), true);
    assert.equal(p.usedSolution, false);
  });
}
test("existing work retains its original full starter and new work receives a scaffold", () => {
  for (const archived of old) {
    const p = initialProgress(archived),
      resumed = missionForProgress(archived.id, p);
    assert.equal(resumed.starter, archived.starter);
    assert.deepEqual(resumed.tests, archived.tests);
    assert.equal(
      missionForProgress(archived.id, { ...p, contentVersion: undefined })
        .contentVersion,
      LEGACY_CONTENT_VERSION,
    );
    const active = missionById(archived.id);
    assert.notEqual(active.starter, archived.starter);
    assert.ok(active.practice);
  }
});
