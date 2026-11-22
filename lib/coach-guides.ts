import { z } from "zod";
import type { Mission } from "./missions.ts";

// These statements are reviewed against the mission contract. Model prose is
// never rendered: the model can only select a guide and cite its published IDs.
const boundaries = {
  frontend:
    "신청 가능은 registered < capacity예요. 정원과 같으면 제외하고, availableOnly가 false이면 정원 조건은 적용하지 않아요. 두 필터를 적용한 결과가 없으면 빈 배열을 반환해요.",
  backend:
    "중복 신청을 먼저 검사해 409를 반환해요. 중복이 아니고 인원이 정원 이상이면 403, 나머지는 201이에요. 입력 배열은 바꾸지 않아요.",
  data: "취소 기록을 먼저 제외한 뒤 같은 카테고리·사용자의 첫 유효 기록만 세요. 참여율은 Math.round(attended / total * 100)으로 계산하고 카테고리 이름순으로 정렬해요. 유효한 기록이 없으면 빈 배열이에요.",
  ai: "점수가 0인 문서는 제외해요(score > 0). 중복 단어는 한 번만 세고, 점수 내림차순·동점 id 오름차순으로 최대 2개를 골라요. 관련 문서나 질문 단어가 없으면 빈 배열이에요.",
  security:
    "비로그인은 401, 본인 기록의 조회·삭제는 200이에요. 관리자의 타인 기록 조회만 200이고 타인 기록 삭제는 403이에요.",
  cloud:
    "요청이 100건 미만이면 먼저 wait예요. 그 외에는 오류율 > 0.02 또는 p95Ms > 500이면 rollback이에요. 정확히 100건·2%·500ms이면 promote예요.",
};
export type CoachGuide = {
  id: string;
  message: string;
  requirementIds: string[];
  checkIds: string[];
  nextAction: "edit" | "inspect";
};
export const requirementId = (m: Mission, index: number) =>
  `${m.id}/requirement/${index + 1}`;
export const checkId = (m: Mission, index: number) =>
  `${m.id}/check/${index + 1}`;
const hintRequirements = {
  frontend: [[0], [0, 1], [2]],
  backend: [[0, 1], [0], [1, 2]],
  data: [[0], [0], [1]],
  ai: [[0], [0, 1], [1, 2]],
  security: [[0, 1], [1], [2]],
  cloud: [[0], [1], [1]],
};
export function coachGuides(m: Mission): CoachGuide[] {
  const requirements = m.steps.map((_, i) => requirementId(m, i));
  return [
    ...m.hints.map((message, i) => ({
      id: `${m.id}/hint/${i + 1}`,
      message,
      requirementIds: hintRequirements[m.id][i].map((index) =>
        requirementId(m, index),
      ),
      checkIds: [],
      nextAction: "edit" as const,
    })),
    {
      id: `${m.id}/boundaries`,
      message: boundaries[m.id],
      requirementIds: requirements,
      checkIds: [],
      nextAction: "edit",
    },
    {
      id: `${m.id}/syntax`,
      message: `문법 오류가 보고됐다면 괄호·따옴표의 짝과 return 위치부터 확인해보세요. 함수 이름은 ${m.fn}로 유지하고 수정 후 다시 실행해보세요.`,
      requirementIds: requirements,
      checkIds: [],
      nextAction: "edit",
    },
    ...m.tests.map((t, i) => ({
      id: `${m.id}/check-guide/${i + 1}`,
      message: `“${t.label}” 항목을 살펴보세요. ${t.why} 입력과 기대값을 코드의 조건과 비교해보세요.`,
      requirementIds: requirements,
      checkIds: [checkId(m, i)],
      nextAction: "inspect" as const,
    })),
  ];
}
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
