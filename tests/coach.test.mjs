import test from "node:test";
import assert from "node:assert/strict";
import { coachInput, getHint } from "../lib/coach.ts";
const input = {
  track: "ai",
  code: "function retrieveDocs(q,d){return []}",
  question: "겹치는 단어를 어떻게 세나요?",
  level: 0,
  tests: [],
};
function setup({ consent = true, allow = true } = {}) {
  const usage = [];
  let reservations = 0;
  return {
    usage,
    get reservations() {
      return reservations;
    },
    read: async () => ({
      state: { profile: { aiConsent: consent, experience: "처음이에요" } },
    }),
    reserve: async () => {
      reservations++;
      return allow;
    },
    logUsage: async (x) => usage.push(x),
  };
}
const reply = (message) =>
  Response.json({
    choices: [{ message }],
    usage: { prompt_tokens: 20, completion_tokens: 10 },
  });
test("coach reads authoritative mission using a real tool loop before suggesting a next step", async () => {
  const store = setup(),
    calls = [];
  const fetcher = async (_, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    if (calls.length === 1)
      return reply({
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "read_mission", arguments: "{}" },
          },
        ],
      });
    if (calls.length === 2)
      return reply({
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "inspect_checks", arguments: "{}" },
          },
        ],
      });
    assert.equal(payload.tool_choice, "none");
    assert.ok(
      payload.messages.some(
        (m) =>
          m.role === "tool" &&
          JSON.parse(m.content).source === "student_browser_unverified",
      ),
    );
    return reply({
      content: JSON.stringify({
        message: "Set으로 중복을 먼저 없애보세요.",
        nextAction: "edit",
      }),
    });
  };
  const result = await getHint(input, "owner", store, {
    apiKey: "test-key",
    model: "test",
    fetcher,
  });
  assert.equal(result.source, "ai");
  assert.deepEqual(result.trace, [
    "과제 조건 확인",
    "실행 전 확인 항목 검토",
    "다음 행동 제안",
  ]);
  assert.equal(calls.length, 3);
  assert.equal(store.usage[0].inputTokens, 60);
  assert.equal(store.usage[0].outcome, "success");
  assert.ok(!JSON.stringify(store.usage).includes(input.code));
});
test("missing credentials, consent, and budget never make provider requests", async () => {
  for (const [store, key] of [
    [setup(), undefined],
    [setup({ consent: false }), "test"],
    [setup({ allow: false }), "test"],
  ]) {
    let called = false;
    const result = await getHint(input, "owner", store, {
      apiKey: key,
      model: "test",
      fetcher: async () => {
        called = true;
        throw Error();
      },
    });
    assert.equal(result.source, "guide");
    assert.equal(called, false);
  }
});
test("provider failure, timeout, and invalid JSON are clearly labelled as basic hints", async () => {
  for (const fetcher of [
    async () => new Response("{}", { status: 429 }),
    async () => {
      throw Error("timeout");
    },
    async () => reply({ content: "invalid" }),
  ]) {
    const store = setup();
    const result = await getHint(input, "owner", store, {
      apiKey: "test",
      model: "test",
      fetcher,
    });
    assert.equal(result.source, "guide");
    assert.ok(result.notice);
    assert.notEqual(store.usage[0].outcome, "success");
  }
});
test("unknown tool calls and unbounded tool loops are rejected", async () => {
  const store = setup();
  const result = await getHint(input, "owner", store, {
    apiKey: "test",
    model: "test",
    fetcher: async () =>
      reply({
        tool_calls: [
          {
            id: "x",
            type: "function",
            function: { name: "read_secrets", arguments: "{}" },
          },
        ],
      }),
  });
  assert.equal(result.source, "guide");
});
test("coach validates every supported role and rejects oversized or empty inputs", () => {
  for (const track of [
    "frontend",
    "backend",
    "data",
    "ai",
    "security",
    "cloud",
  ])
    assert.ok(coachInput.safeParse({ ...input, track }).success);
  for (const value of [
    { ...input, track: "unknown" },
    { ...input, question: " " },
    { ...input, code: "a".repeat(20001) },
    { ...input, tests: Array(6).fill({ label: "x", passed: false }) },
  ])
    assert.equal(coachInput.safeParse(value).success, false);
});
