import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { missions, initialProgress } from "../lib/missions.ts";
import {
  normalizeProfile,
  normalizeLabState,
  profileAnswer,
  profileAnswerLabel,
  updateProfileAnswer,
  changeCode,
  snapshotExecution,
  canRecordAttempt,
  currentExecution,
  isCompleted,
} from "../lib/lab-state.ts";
import { stateSchema } from "../lib/server.ts";
const mission = missions[0],
  result = {
    tests: [{ label: "partial", passed: false, why: "not yet" }],
    preview: [],
  };
const change = (p, code, source = "user") => ({
  ...p,
  ...changeCode(p, code, source),
});
const run = async (p, output = result) => ({
  ...p,
  runs: p.runs + 1,
  lastExecution: await snapshotExecution(
    p,
    mission,
    output,
    "2026-11-22T00:00:00.000Z",
  ),
});
test("new profiles stay unanswered and optional answers carry their own provenance", () => {
  let p = normalizeProfile(null);
  assert.equal(p.experience, null);
  assert.equal(p.purpose, null);
  assert.equal(profileAnswerLabel(p, "experience"), "미응답");
  p = updateProfileAnswer(
    { ...p, aiConsent: true },
    "experience",
    "기초 문법을 배웠어요",
  );
  assert.equal(profileAnswer(p, "experience"), "기초 문법을 배웠어요");
  assert.equal(profileAnswer(p, "purpose"), null);
  p = updateProfileAnswer(p, "experience", "");
  assert.equal(profileAnswer(p, "experience"), null);
  assert.equal(p.aiConsent, true);
});
test("legacy strings survive migration but are never treated as confirmed answers", () => {
  const legacy = {
    experience: "기초 문법을 배웠어요",
    purpose: "목적",
    aiConsent: true,
  };
  const p = normalizeProfile(legacy);
  assert.equal(p.experience, legacy.experience);
  assert.equal(p.experienceSource, "legacy_unverified");
  assert.equal(profileAnswer(p, "experience"), null);
  assert.match(profileAnswerLabel(p, "experience"), /미확인/);
  assert.deepEqual(normalizeProfile(p), p);
  const state = {
    version: 1,
    profile: legacy,
    progress: {
      frontend: {
        ...initialProgress(mission),
        reflection: {
          interest: 3,
          difficulty: 3,
          again: 3,
          note: "old note",
          next: "next",
          endedAt: "2026-11-22T00:00:00.000Z",
        },
      },
    },
  };
  const normalized = normalizeLabState(state);
  assert.equal(normalized.progress.frontend.reflection.note, "old note");
  assert.equal(isCompleted(normalized.progress.frontend), false);
  assert.equal(
    stateSchema.parse(state).profile.experienceSource,
    "legacy_unverified",
  );
});
test("running the starter and only then editing does not count as an edited run", async () => {
  const p = change(
    await run(initialProgress(mission)),
    mission.starter + "\n// not executed",
  );
  assert.equal(canRecordAttempt(p), false);
  assert.equal(currentExecution(p), undefined);
});
test("failed edited executions qualify, with the exact code hash and timestamp preserved", async () => {
  const code = 'function selectEvents(){ throw Error("still learning") }';
  const p = await run(change(initialProgress(mission), code), {
    tests: [],
    preview: null,
    error: "still learning",
  });
  assert.equal(canRecordAttempt(p), true);
  assert.equal(
    p.lastExecution.codeHash,
    createHash("sha256").update(code).digest("hex"),
  );
  assert.equal(p.lastExecution.executedAt, "2026-11-22T00:00:00.000Z");
  const saved = {
    ...p,
    reflection: {
      interest: 3,
      difficulty: 3,
      again: 4,
      note: "why",
      next: "next",
      endedAt: "2026-11-22T01:00:00.000Z",
      execution: p.lastExecution,
    },
  };
  const newer = change(saved, code + "\n// next attempt");
  assert.equal(canRecordAttempt(newer), false);
  assert.equal(isCompleted(newer), true);
  assert.equal(newer.reflection.execution.id, p.lastExecution.id);
  assert.equal(
    stateSchema.parse({ version: 1, progress: { frontend: saved } }).progress
      .frontend.reflection.execution.codeHash,
    p.lastExecution.codeHash,
  );
});
test("reference-only execution does not complete a track, editing it and rerunning does", async () => {
  const reference = await run(
    change(initialProgress(mission), mission.solution, "reference"),
  );
  assert.equal(canRecordAttempt(reference), false);
  assert.equal(reference.lastExecution.kind, "reference");
  const edited = change(
    reference,
    mission.solution + "\n// changed after reading",
  );
  assert.equal(canRecordAttempt(edited), false);
  assert.equal(canRecordAttempt(await run(edited)), true);
});
test("legacy results without an execution snapshot cannot be sent as current evidence", () => {
  const old = { ...initialProgress(mission), runs: 9, result };
  assert.equal(currentExecution(old), undefined);
  assert.equal(canRecordAttempt(old), false);
});
