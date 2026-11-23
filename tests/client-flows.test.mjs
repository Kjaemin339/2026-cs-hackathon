import test from "node:test";
import assert from "node:assert/strict";
import { clientHarness, deferred } from "./helpers/client-harness.mjs";
import { DRAFT_KEY } from "../lib/persistence.ts";

test("deleting records while code runs discards the late result instead of autosaving it", async (t) => {
  const f = await clientHarness(t);
  await f.click("코드 실행");
  await f.click("나의 기록");
  await f.click("전체 기록 삭제");
  await f.click(
    "전체 기록 삭제",
    f.dom.window.document.querySelector('[role="dialog"]'),
  );
  assert.equal(f.stored, null);
  const deletion = f.calls.findIndex((call) => call.method === "DELETE");
  await f.finishRun({
    tests: [
      {
        label: "test",
        passed: true,
        why: "fixture",
        actual: "erased result",
        expected: "erased result",
      },
    ],
    preview: null,
  });
  await f.settle(1000);
  assert.equal(f.stored, null);
  assert.equal(
    f.calls
      .slice(deletion + 1)
      .some((call) => call.url === "/api/state" && call.method === "POST"),
    false,
  );
  assert.equal(localStorage.getItem(DRAFT_KEY), null);
});

test("deletion in another tab also invalidates an in-flight execution", async (t) => {
  const f = await clientHarness(t);
  await f.click("코드 실행");
  const before = f.calls.length;
  await f.act(async () => {
    localStorage.removeItem(DRAFT_KEY);
    f.dom.window.dispatchEvent(
      new f.dom.window.StorageEvent("storage", {
        key: DRAFT_KEY,
        newValue: null,
      }),
    );
  });
  await f.finishRun();
  await f.settle(1000);
  assert.equal(
    f.calls.slice(before).some((call) => call.method === "POST"),
    false,
  );
  assert.equal(localStorage.getItem(DRAFT_KEY), null);
});

for (const game of [false, true]) {
  test(`${game ? "game" : "code"} direct links wait for existing consent and record one complete journey`, async (t) => {
    const consentGate = deferred();
    const f = await clientHarness(t, { game, analytics: true, consentGate });
    assert.match(
      f.dom.window.document.body.textContent,
      /참여 설정을 확인하고 있어요/,
    );
    assert.equal(f.events.length, 0);
    await f.act(async () => consentGate.resolve());
    await f.settle();
    if (game) await f.click("결과 확인");
    else {
      await f.click("코드 실행");
      await f.finishRun({
        tests: [
          {
            label: "fixture",
            passed: false,
            why: "fixture",
            actual: false,
            expected: true,
          },
        ],
        preview: null,
      });
    }
    await f.settle(700);
    const starts = f.events.filter((e) => e.name === "mission_start");
    const results = f.events.filter(
      (e) => e.name === (game ? "game_check" : "run_result"),
    );
    assert.equal(starts.length, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].context.journeyId, starts[0].context.journeyId);
  });
  for (const analyticsError of [false, true]) {
    test(`${game ? "game" : "code"} remains usable without collection when consent is ${analyticsError ? "unavailable" : "off"}`, async (t) => {
      const f = await clientHarness(t, { game, analyticsError });
      if (game) await f.click("결과 확인");
      else {
        await f.click("코드 실행");
        await f.finishRun();
      }
      await f.settle(700);
      assert.deepEqual(f.events, []);
    });
  }
}
