import { missions, LEGACY_CONTENT_VERSION } from "./missions.ts";
import type {
  LabState,
  Mission,
  Reflection,
  NextActionPlan,
  TrackId,
  Progress,
} from "./missions.ts";
import { isCompleted } from "./lab-state.ts";
import { missionCatalog } from "./mission-catalog.ts";

import {
  NEXT_ACTION_RULE_VERSION,
  nextActionSuggestion,
} from "./next-actions-v1.ts";
export {
  NEXT_ACTION_RULE_VERSION,
  nextActionSuggestion,
  actionCandidate,
} from "./next-actions-v1.ts";
const ruleSets = new Map([[NEXT_ACTION_RULE_VERSION, nextActionSuggestion]]);
export type Ratings = Pick<Reflection, "interest" | "difficulty" | "again">;
export type RecommendationContext = NextActionPlan["context"];
function hasReflectionBasis(progress: Progress | undefined): boolean {
  const r = progress?.reflection;
  return (
    isCompleted(progress) &&
    !!r?.note.trim() &&
    [r.interest, r.difficulty, r.again].every(
      (v) => Number.isInteger(v) && v >= 1 && v <= 5,
    )
  );
}
export function recommendationContext(
  state: LabState,
  current: TrackId,
  ratings: Ratings,
  catalog: Pick<typeof missionCatalog, "canStart" | "resolve"> = missionCatalog,
): RecommendationContext {
  const completed = missions.flatMap((m) => {
    const p = state.progress[m.id];
    return m.id !== current && hasReflectionBasis(p)
      ? [{ track: m.id, interest: p!.reflection!.interest }]
      : [];
  });
  completed.push({ track: current, interest: ratings.interest });
  const completedIds = new Set(completed.map((c) => c.track));
  const availableTracks = missions
    .filter(
      (m) =>
        !completedIds.has(m.id) &&
        (state.progress[m.id]
          ? !!catalog.resolve(
              m.id,
              state.progress[m.id]!.contentVersion ?? LEGACY_CONTENT_VERSION,
            )
          : catalog.canStart(m.id)),
    )
    .map((m) => m.id);
  return { completed, availableTracks };
}
export function makeNextActionPlan(
  mission: Mission,
  executionId: string,
  ratings: Ratings,
  context: RecommendationContext,
  selectedId: string,
  selectionReason: string,
): NextActionPlan | null {
  const suggestion = nextActionSuggestion(ratings, mission.id, context);
  if (
    !suggestion ||
    !suggestion.candidates.some((c) => c.id === selectedId) ||
    !selectionReason.trim() ||
    selectionReason.trim().length > 300
  )
    return null;
  return {
    ruleVersion: NEXT_ACTION_RULE_VERSION,
    track: mission.id,
    contentVersion: mission.contentVersion,
    executionId,
    ratings: {
      interest: ratings.interest,
      difficulty: ratings.difficulty,
      again: ratings.again,
    },
    context: structuredClone(context),
    ...structuredClone(suggestion),
    selectedId,
    selectionReason: selectionReason.trim(),
  };
}
export function validNextActionPlan(
  plan: NextActionPlan,
  reflection: Reflection,
  track: TrackId,
  contentVersion?: string,
): boolean {
  if (
    !reflection.note.trim() ||
    reflection.execution?.kind !== "edited" ||
    reflection.execution.contentVersion !== plan.contentVersion ||
    reflection.execution.missionId !== track
  )
    return false;
  const rules = ruleSets.get(plan.ruleVersion);
  if (
    !rules ||
    plan.track !== track ||
    plan.contentVersion !== contentVersion ||
    plan.executionId !== reflection.execution?.id
  )
    return false;
  if (
    plan.ratings.interest !== reflection.interest ||
    plan.ratings.difficulty !== reflection.difficulty ||
    plan.ratings.again !== reflection.again
  )
    return false;
  const done = plan.context.completed,
    available = plan.context.availableTracks;
  if (
    new Set(done.map((c) => c.track)).size !== done.length ||
    new Set(available).size !== available.length ||
    available.some((id) => done.some((c) => c.track === id)) ||
    !done.some((c) => c.track === track && c.interest === reflection.interest)
  )
    return false;
  const expected = rules(plan.ratings, track, plan.context);
  if (
    !expected ||
    expected.ruleId !== plan.ruleId ||
    expected.reason !== plan.reason ||
    JSON.stringify(expected.candidates) !== JSON.stringify(plan.candidates)
  )
    return false;
  const selected = plan.candidates.find((c) => c.id === plan.selectedId);
  return (
    !!selected &&
    selected.title === reflection.next &&
    !!plan.selectionReason.trim()
  );
}
export function representativeTracks(state: LabState): TrackId[] {
  const done = missions.filter((m) => hasReflectionBasis(state.progress[m.id]));
  if (done.length < 2) return [];
  const highest = Math.max(
    ...done.map((m) => state.progress[m.id]!.reflection!.interest),
  );
  return done
    .filter((m) => state.progress[m.id]!.reflection!.interest === highest)
    .map((m) => m.id);
}
