import test from "node:test";
import assert from "node:assert/strict";
import { describeResult, describeInput } from "../lib/check-explanation.ts";
import { missions } from "../lib/missions.ts";
test("approved checks have short inputs and human-readable expected outcomes for all six roles", () => {
  for (const m of missions)
    for (let i = 0; i < m.tests.length; i++) {
      const input = describeInput(m, i),
        output = describeResult(m.id, m.tests[i].expected);
      assert.ok(input.length > 0 && input.length < 250);
      assert.ok(output.length > 0 && output.length < 600);
      assert.ok(!output.includes('"registered":'));
      assert.ok(!output.includes('"ownerId":'));
    }
  assert.match(describeResult("frontend", []), /행사 없음/);
  assert.match(
    describeResult("data", [
      { category: "개발", total: 2, attended: 1, rate: 50 },
    ]),
    /신청 2명.*참여 1명.*50%/,
  );
  assert.equal(describeResult("security", 403), "접근 거절 (403)");
  assert.match(describeResult("cloud", "rollback"), /되돌려요/);
});
test("unexpected learner values remain safely readable, bounded and do not become trusted labels", () => {
  const circular = {};
  circular.self = circular;
  for (const value of [
    undefined,
    null,
    { toString: "bad" },
    "constructor",
    "__proto__",
    "x".repeat(2000),
    circular,
  ])
    for (const m of missions)
      assert.ok(typeof describeResult(m.id, value) === "string");
  assert.ok(describeResult("cloud", "constructor").includes("constructor"));
  assert.doesNotThrow(() =>
    describeResult("data", [
      { category: "개발", total: { toString: "bad" }, attended: 1, rate: 50 },
    ]),
  );
  assert.ok(describeResult("backend", "x".repeat(2000)).length <= 600);
});
