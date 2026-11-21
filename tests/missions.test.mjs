import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { missions, events, rows } from "../lib/missions.ts";
const evaluate = (m, code, args) =>
  JSON.parse(
    JSON.stringify(
      vm.runInNewContext(
        code + ";\n" + m.fn + "(...input)",
        { input: structuredClone(args) },
        { timeout: 300 },
      ),
    ),
  );
// Keep the fixtures executable: every published reference must satisfy the full
// brief, and starter code must leave meaningful work for the learner.
for (const m of missions) {
  test(`${m.id}: reference meets all published scenarios`, () => {
    for (const scenario of m.tests)
      assert.deepEqual(
        evaluate(m, m.solution, scenario.args),
        scenario.expected,
        scenario.label,
      );
  });
  test(`${m.id}: starter leaves at least one scenario unresolved`, () => {
    const passed = m.tests.filter((t) => {
      try {
        return (
          JSON.stringify(evaluate(m, m.starter, t.args)) ===
          JSON.stringify(t.expected)
        );
      } catch {
        return false;
      }
    }).length;
    assert.ok(passed < m.tests.length);
  });
}
test("backend accepts empty list and zero capacity is full", () => {
  const m = missions[1];
  assert.deepEqual(evaluate(m, m.solution, [[], "new", 1]), {
    status: 201,
    accepted: true,
  });
  assert.deepEqual(evaluate(m, m.solution, [[], "new", 0]), {
    status: 403,
    accepted: false,
  });
});
test("data removes cancelled records before selecting first valid record", () => {
  const m = missions[2];
  assert.deepEqual(
    evaluate(m, m.solution, [
      [
        { userId: "a", category: "개발", attended: false, cancelled: true },
        { userId: "a", category: "개발", attended: true, cancelled: false },
      ],
    ]),
    [{ category: "개발", total: 1, attended: 1, rate: 100 }],
  );
});
test("frontend does not mutate source data or invent unknown categories", () => {
  const m = missions[0];
  const source = structuredClone(events);
  assert.deepEqual(evaluate(m, m.solution, [source, "없는 분류", true]), []);
  assert.deepEqual(source, events);
});
test("invalid and endlessly running learner code is interruptible", () => {
  assert.throws(() =>
    evaluate(missions[0], "function selectEvents( {", [events, "전체", false]),
  );
  assert.throws(
    () =>
      evaluate(missions[0], "function selectEvents(){while(true){}}", [
        events,
        "전체",
        false,
      ]),
    /timed out/,
  );
});
