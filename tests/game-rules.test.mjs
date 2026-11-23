import test from "node:test";
import assert from "node:assert/strict";
import {
  backendState,
  advanceBackend,
  backendFeedback,
  dataFeedback,
  aiFeedback,
  securityFeedback,
  cloudFeedback,
  frontendFeedback,
} from "../lib/game-rules.ts";
test("frontend points to the next control and accepts only a large, wrapping label within the width limit", () => {
  assert.match(frontendFeedback(70, false, false), /큰 글자/);
  assert.match(frontendFeedback(200, false, true), /120px/);
  assert.match(frontendFeedback(120, false, true), /줄바꿈/);
  for (const width of [55, 70, 120, 121, 200])
    for (const wrap of [false, true])
      for (const zoom of [false, true])
        assert.equal(
          frontendFeedback(width, wrap, zoom) === "",
          width <= 120 && wrap && zoom,
        );
});
test("the simultaneous-request demo really oversells; both safe processing orders issue exactly one ticket", () => {
  const broken = backendState([0, 1, 0, 1, 0, 1]);
  assert.equal(broken.seats, -1);
  assert.deepEqual(broken.tickets, [true, true]);
  assert.match(backendFeedback([0, 1, 0, 1, 0, 1], false), /두 사람/);
  let completed = 0;
  const walk = (turns) => {
    const state = backendState(turns);
    assert.ok(state.seats >= 0);
    assert.ok(state.tickets.filter(Boolean).length <= 1);
    if (turns.length === 6) {
      completed++;
      assert.equal(backendFeedback(turns, true), "");
      assert.equal(state.seats, 0);
      return;
    }
    for (const who of [0, 1]) {
      const next = advanceBackend(turns, who, true);
      if (next.length > turns.length) walk(next);
    }
  };
  walk([]);
  assert.equal(completed, 2);
  assert.deepEqual(advanceBackend([0], 1, true), [0]);
  assert.match(backendFeedback([0], true), /民|민지.*표 발급/);
  assert.notEqual(backendFeedback([0, 0, 0, 1, 1, 1], false), "");
});
test("data evaluates all 32 selections and gives a record-specific correction", () => {
  let accepted = 0;
  for (let bits = 0; bits < 32; bits++) {
    const keep = Array.from({ length: 5 }, (_, i) => Boolean(bits & (1 << i)));
    if (dataFeedback(keep) === "") {
      accepted++;
      assert.deepEqual(keep, [true, true, false, true, false]);
    }
  }
  assert.equal(accepted, 1);
  assert.match(dataFeedback([true, true, true, true, true]), /민지.*10:02/);
  assert.match(
    dataFeedback([false, true, false, true, false]),
    /민지.*첫 입장/,
  );
});
test("AI requires the relevant notice and an answer matching it across 64 combinations", () => {
  let accepted = 0;
  for (const source of [null, 0, 1, 2])
    for (const time of ["", "오후 5시", "오후 6시", "오후 7시"])
      for (const place of ["", "강당", "운동장", "학생회관"]) {
        if (aiFeedback(source, time, place) === "") {
          accepted++;
          assert.equal(source, 1);
          assert.equal(time, "오후 7시");
          assert.equal(place, "학생회관");
        }
      }
  assert.equal(accepted, 1);
  assert.match(aiFeedback(null, "", ""), /먼저/);
  assert.match(aiFeedback(0, "오후 7시", "학생회관"), /이번 주 영화제/);
});
test("security checks all 512 permission sets, including overbroad access and missing access", () => {
  let accepted = 0;
  for (let bits = 0; bits < 512; bits++) {
    const keys = Array.from({ length: 9 }, (_, i) => i).filter(
      (i) => bits & (1 << i),
    );
    if (securityFeedback(keys) === "") {
      accepted++;
      assert.deepEqual(keys, [0, 3, 4, 6, 8]);
    }
  }
  assert.equal(accepted, 1);
  assert.match(securityFeedback([0, 2, 3, 4, 6, 8]), /손님.*전체 명단.*잠가/);
  assert.match(securityFeedback([0, 3, 6, 8]), /참가자.*내 입장권/);
});
test("cloud preserves the resource budget across 343 allocations and points to the busy service", () => {
  let accepted = 0;
  for (let a = 0; a <= 6; a++)
    for (let b = 0; b <= 6; b++)
      for (let c = 0; c <= 6; c++)
        if (cloudFeedback([a, b, c]) === "") {
          accepted++;
          assert.deepEqual([a, b, c], [1, 3, 2]);
        }
  assert.equal(accepted, 1);
  assert.match(cloudFeedback([1, 1, 1]), /신청.*16건/);
  assert.match(cloudFeedback([2, 3, 2]), /여섯 대/);
});
