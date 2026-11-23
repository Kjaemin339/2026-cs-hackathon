import { z } from "zod";
import type { Mission } from "./missions.ts";

// All instructional text belongs to the immutable content release.
export type CoachGuide = Mission["guides"][number];
export const requirementId = (m: Mission, index: number) =>
  `${m.id}/requirement/${index + 1}`;
export const checkId = (m: Mission, index: number) =>
  `${m.id}/check/${index + 1}`;
export const coachGuides = (m: Mission): CoachGuide[] => m.guides;
const selectionSchema = z.object({ guideId: z.string().max(100) }).strict();
export function validateSelection(
  value: unknown,
  m: Mission,
  inspected: Set<string>,
) {
  const parsed = selectionSchema.safeParse(value);
  if (
    !parsed.success ||
    !inspected.has("read_mission") ||
    !inspected.has("inspect_checks")
  )
    return null;
  const guide = coachGuides(m).find((g) => g.id === parsed.data.guideId);
  // The server derives citations; the provider cannot invent or rewrite them.
  const validIds = (ids: string[], known: string[]) =>
    new Set(ids).size === ids.length && ids.every((id) => known.includes(id));
  if (
    !guide ||
    guide.requirementIds.length === 0 ||
    !validIds(
      guide.requirementIds,
      m.steps.map((_, i) => requirementId(m, i)),
    ) ||
    !validIds(
      guide.checkIds,
      m.tests.map((_, i) => checkId(m, i)),
    )
  )
    return null;
  return {
    message: guide.message,
    nextAction: guide.nextAction,
    guideId: guide.id,
    contentVersion: m.contentVersion,
    references: [
      ...m.steps.flatMap((label, i) =>
        guide.requirementIds.includes(requirementId(m, i))
          ? [
              {
                id: requirementId(m, i),
                label,
                kind: "requirement" as const,
              },
            ]
          : [],
      ),
      ...m.tests.flatMap((t, i) =>
        guide.checkIds.includes(checkId(m, i))
          ? [{ id: checkId(m, i), label: t.label, kind: "check" as const }]
          : [],
      ),
    ],
  };
}
export function reportedChecks(
  m: Mission,
  reports: { label: string; passed: boolean; error?: string }[],
) {
  return m.tests.map((t, i) => {
    const matches = reports.filter((r) => r.label === t.label);
    // Duplicate/conflicting labels are ambiguous. Never count them as evidence.
    const report = matches.length === 1 ? matches[0] : null;
    return {
      id: checkId(m, i),
      label: t.label,
      why: t.why,
      args: t.args,
      expected: t.expected,
      reported: report ? { passed: report.passed, error: report.error } : null,
    };
  });
}
