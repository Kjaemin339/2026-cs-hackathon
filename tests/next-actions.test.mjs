import {
  releaseMissions as archived,
  CONTENT_VERSION as archivedVersion,
} from "../lib/content/2026-11-23.1.ts";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { missions, initialProgress } from "../lib/missions.ts";
import { createMissionCatalog } from "../lib/mission-catalog.ts";
import {
  snapshotExecution,
  changeCode,
  isCompleted,
} from "../lib/lab-state.ts";
import {
  nextActionSuggestion,
  recommendationContext,
  makeNextActionPlan,
  representativeTracks,
} from "../lib/next-actions.ts";
import { stateSchema } from "../lib/server.ts";
const m = missions[0];
const ratings = (interest = 4, difficulty = 3, again = 4) => ({
  interest,
  difficulty,
  again,
});
const context = (track = m.id, interest = 4) => ({
  completed: [{ track, interest }],
  availableTracks: missions.filter((x) => x.id !== track).map((x) => x.id),
});
async function completed(mission = m, scores = ratings(), help = false) {
  const p = {
    ...initialProgress(mission),
    ...changeCode(
      initialProgress(mission),
      mission.solution + "\n// my attempt",
      "user",
    ),
    usedSolution: help,
    hintLevel: help ? 3 : 0,
  };
  // A failed edited execution is valid experience, not an aptitude grade.
  p.lastExecution = await snapshotExecution(
    p,
    mission,
    {
      tests: [
        {
          label: mission.tests[0].label,
          passed: false,
          why: mission.tests[0].why,
        },
      ],
      preview: null,
    },
    "2026-11-23T00:00:00.000Z",
  );
  p.reflection = {
    ...scores,
    note: "I tried and learned",
    next: "old chosen activity",
    endedAt: "2026-11-23T00:00:00.000Z",
    execution: p.lastExecution,
  };
  return p;
}
for (const mission of missions)
  test(`${mission.id}: all 125 score combinations follow the ordered decision table`, () => {
    const highInterestMatrix = [
      ["study", "study", "study", "extend", "extend"],
      ["study", "study", "study", "extend", "extend"],
      ["study", "study", "study", "extend", "extend"],
      [
        "foundation-first",
        "foundation-first",
        "foundation-first",
        "foundation-first",
        "foundation-first",
      ],
      [
        "foundation-first",
        "foundation-first",
        "foundation-first",
        "foundation-first",
        "foundation-first",
      ],
    ];
    for (let i = 1; i <= 5; i++)
      for (let d = 1; d <= 5; d++)
        for (let r = 1; r <= 5; r++) {
          const result = nextActionSuggestion(
            ratings(i, d, r),
            mission.id,
            context(mission.id, i),
          );
          assert.equal(
            result.ruleId,
            i <= 3 ? "explore" : highInterestMatrix[d - 1][r - 1],
            `${i}/${d}/${r}`,
          );
          assert.ok(result.candidates.length > 0);
        }
  });
test("missing or invalid self-report never becomes a default recommendation", () => {
  for (const field of ["interest", "difficulty", "again"])
    for (const value of [0, 6, NaN, 2.5, undefined]) {
      assert.equal(
        nextActionSuggestion({ ...ratings(), [field]: value }, m.id, context()),
        null,
      );
    }
});
test("only confirmed experiences count; unfinished known sessions can be resumed and unknown versions are not offered", async () => {
  const other = missions[1],
    state = { version: 1, progress: { [other.id]: await completed(other) } };
  const legacy = {
    ...(await completed(missions[2])),
    reflection: {
      ...(await completed(missions[2])).reflection,
      execution: undefined,
    },
  };
  state.progress.data = legacy;
  state.progress.ai = {
    ...initialProgress(missions[3]),
    contentVersion: "unknown",
  };
  const result = recommendationContext(state, m.id, ratings(2));
  assert.deepEqual(
    new Set(result.completed.map((c) => c.track)),
    new Set([m.id, other.id]),
  );
  assert.ok(result.availableTracks.includes("data"));
  assert.ok(!result.availableTracks.includes("ai"));
  assert.deepEqual(
    representativeTracks({ version: 1, progress: { data: legacy } }),
    [],
  );
});
test("paused new starts are excluded but already started reviewed sessions can still be suggested", () => {
  const catalog = createMissionCatalog(
    [
      {
        version: m.contentVersion,
        reviewStatus: "reviewed",
        reviewedAt: "2026-11-23",
        acceptingNewStarts: true,
        pausedMissionIds: ["backend", "data"],
        missions: [...missions],
      },
    ],
    m.contentVersion,
  );
  const state = {
    version: 1,
    progress: { backend: initialProgress(missions[1]) },
  };
  const result = recommendationContext(state, m.id, ratings(2), catalog);
  assert.ok(result.availableTracks.includes("backend"));
  assert.ok(!result.availableTracks.includes("data"));
});
test("all-six fallback retains every top-interest tie without inventing a job ranking", () => {
  const done = missions.map((x) => ({ track: x.id, interest: 3 }));
  const result = nextActionSuggestion(ratings(3), m.id, {
    completed: done,
    availableTracks: [],
  });
  assert.equal(result.ruleId, "revisit");
  assert.equal(result.candidates.length, 6);
  const twoBest = done.map((c, i) => ({
    ...c,
    interest: i === 1 || i === 4 ? 5 : 3,
  }));
  assert.deepEqual(
    nextActionSuggestion(ratings(3), m.id, {
      completed: twoBest,
      availableTracks: [],
    }).candidates.map((c) => c.track),
    ["backend", "security"],
  );
});
test("broader exploration needs all six low-interest experiences; unavailable or missing records do not qualify", () => {
  const allLow = missions.map((x) => ({ track: x.id, interest: 2 }));
  assert.equal(
    nextActionSuggestion(ratings(2), m.id, {
      completed: allLow,
      availableTracks: [],
    }).ruleId,
    "broader",
  );
  assert.equal(
    nextActionSuggestion(ratings(2), m.id, {
      completed: allLow.slice(0, 2),
      availableTracks: [],
    }).ruleId,
    "review",
  );
});
test("help use and test failures do not penalize candidates, and comparison waits for two confirmed reflections", async () => {
  const a = await completed(m, ratings(4, 4, 5), true);
  const b = await completed(missions[1], ratings(4, 2, 3), false);
  const state = { version: 1, progress: { frontend: a } };
  assert.equal(isCompleted(a), true);
  assert.deepEqual(representativeTracks(state), []);
  state.progress.backend = b;
  assert.deepEqual(representativeTracks(state), ["frontend", "backend"]);
  const result = nextActionSuggestion(
    a.reflection,
    m.id,
    recommendationContext(state, m.id, a.reflection),
  );
  assert.equal(result.ruleId, "foundation-first");
});
async function planned() {
  const p = await completed(),
    ctx = context();
  const suggestion = nextActionSuggestion(p.reflection, m.id, ctx);
  const plan = makeNextActionPlan(
    m,
    p.reflection.execution.id,
    p.reflection,
    ctx,
    suggestion.candidates[0].id,
    "  더 해보고 싶어서요  ",
  );
  p.reflection = {
    ...p.reflection,
    next: suggestion.candidates[0].title,
    nextPlan: plan,
  };
  return { version: 1, progress: { frontend: p } };
}
test("explicit choice and a short reason are required; stale or unknown candidate IDs cannot be saved", async () => {
  const p = await completed(),
    ctx = context();
  for (const [id, reason] of [
    ["bad", "because"],
    ["extend/frontend", " "],
    ["extend/frontend", "a".repeat(301)],
    ["study/frontend", "because"],
  ])
    assert.equal(
      makeNextActionPlan(
        m,
        p.reflection.execution.id,
        p.reflection,
        ctx,
        id,
        reason,
      ),
      null,
    );
});
test("candidate set, rule, self-report and user reason survive validation; later progress does not rewrite history", async () => {
  const state = await planned(),
    saved = structuredClone(state.progress.frontend.reflection.nextPlan);
  assert.equal(saved.selectionReason, "더 해보고 싶어서요");
  state.progress.backend = await completed(missions[1]);
  const restored = stateSchema.parse(state);
  assert.deepEqual(restored.progress.frontend.reflection.nextPlan, saved);
  assert.equal(
    restored.progress.frontend.reflection.next,
    saved.candidates[0].title,
  );
});
test("server rejects altered candidates, explanations, ratings, execution basis, selection and invalid contexts", async () => {
  const base = await planned();
  for (const mutate of [
    (r) => (r.nextPlan.candidates[0].title = "unreviewed course"),
    (r) => (r.nextPlan.reason = "you are not suitable"),
    (r) => (r.nextPlan.selectedId = "not-present"),
    (r) => (r.nextPlan.selectionReason = " "),
    (r) => (r.nextPlan.ratings.interest = 3),
    (r) => (r.nextPlan.executionId = crypto.randomUUID()),
    (r) => (r.nextPlan.contentVersion = "unknown"),
    (r) => (r.nextPlan.ruleVersion = "unknown"),
    (r) => (r.nextPlan.ruleVersion = "__proto__"),
    (r) => (r.nextPlan.ruleVersion = "constructor"),
    (r) => (r.execution.kind = "reference"),
    (r) => (r.execution.contentVersion = "different"),
    (r) => (r.execution.missionId = "backend"),
    (r) => (r.next = "mismatched title"),
    (r) => (r.note = " "),
    (r) => r.nextPlan.context.completed.push(r.nextPlan.context.completed[0]),
    (r) => r.nextPlan.context.availableTracks.push("frontend"),
  ]) {
    const value = structuredClone(base);
    mutate(value.progress.frontend.reflection);
    assert.equal(stateSchema.safeParse(value).success, false);
  }
});
test("six-way ties remain a valid persisted choice; legacy free-text choices are preserved without invented plans", async () => {
  const p = await completed(m, ratings(3)),
    ctx = {
      completed: missions.map((x) => ({ track: x.id, interest: 3 })),
      availableTracks: [],
    };
  const suggestion = nextActionSuggestion(p.reflection, m.id, ctx),
    chosen = suggestion.candidates[5];
  p.reflection = {
    ...p.reflection,
    next: chosen.title,
    nextPlan: makeNextActionPlan(
      m,
      p.reflection.execution.id,
      p.reflection,
      ctx,
      chosen.id,
      "스스로 골랐어요",
    ),
  };
  assert.equal(
    stateSchema.parse({ version: 1, progress: { frontend: p } }).progress
      .frontend.reflection.nextPlan.candidates.length,
    6,
  );
  delete p.reflection.nextPlan;
  p.reflection.next = "내가 예전에 적은 다음 활동";
  const legacy = stateSchema.parse({ version: 1, progress: { frontend: p } })
    .progress.frontend.reflection;
  assert.equal(legacy.next, p.reflection.next);
  assert.equal(legacy.nextPlan, undefined);
});

test("legacy in-progress work resolves its original reviewed version even when the active release is a draft", () => {
  const future = missions.map((m) => ({
    ...structuredClone(m),
    contentVersion: "future-draft",
  }));
  const catalog = createMissionCatalog(
    [
      {
        version: archivedVersion,
        reviewStatus: "reviewed",
        reviewedAt: "2026-11-23",
        acceptingNewStarts: false,
        missions: [...archived],
      },
      {
        version: "future-draft",
        reviewStatus: "draft",
        reviewedAt: null,
        acceptingNewStarts: false,
        missions: future,
      },
    ],
    "future-draft",
  );
  const p = { ...initialProgress(missions[1]), contentVersion: undefined };
  const result = recommendationContext(
    { version: 1, progress: { backend: p } },
    m.id,
    ratings(2),
    catalog,
  );
  assert.deepEqual(result.availableTracks, ["backend"]);
});

test("empty reflection notes do not count as recommendation or comparison evidence", async () => {
  const empty = await completed(missions[1]);
  empty.reflection.note = " ";
  const state = {
    version: 1,
    progress: { backend: empty, frontend: await completed(m) },
  };
  assert.deepEqual(representativeTracks(state), []);
  const ctx = recommendationContext(state, m.id, ratings(2));
  assert.ok(!ctx.completed.some((c) => c.track === "backend"));
  assert.ok(ctx.availableTracks.includes("backend"));
});

test("the published recommendation rule file stays unchanged for historical choices", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../lib/next-actions-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const contents = await readFile(
    new URL("../lib/next-actions-v1.ts", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(contents).digest("hex"),
    manifest["2026-11-23.1"].sha256,
  );
});

test("a missing mission release does not erase a historical plan with a known recommendation rule", async () => {
  const state = await planned(),
    p = state.progress.frontend;
  p.contentVersion = "unavailable-archive";
  p.reflection.execution.contentVersion = "unavailable-archive";
  p.lastExecution.contentVersion = "unavailable-archive";
  p.reflection.nextPlan.contentVersion = "unavailable-archive";
  const restored = stateSchema.parse(state);
  assert.equal(
    restored.progress.frontend.reflection.nextPlan.selectionReason,
    p.reflection.nextPlan.selectionReason,
  );
  assert.equal(isCompleted(restored.progress.frontend), false);
});
