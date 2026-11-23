import type {
  Reflection,
  NextActionCandidate,
  NextActionPlan,
  TrackId,
} from "./missions.ts";
export const NEXT_ACTION_RULE_VERSION = "2026-11-23.1";
// Reviewed activities stay here with their rule version. Historical plans keep
// the presented candidates and basis; they are not recalculated on read.
const activities: Record<
  TrackId,
  { foundation: string; extend: string; study: string }
> = {
  frontend: {
    foundation: "filter와 조건식을 복습하고 행사 필터 다시 만들기",
    extend: "행사 목록에 검색어 필터 추가하기",
    study: "사용자 입력과 화면 상태의 관계 정리하기",
  },
  backend: {
    foundation: "if와 조기 반환을 복습하고 신청 규칙 다시 만들기",
    extend: "행사 신청에 취소 요청 규칙 추가하기",
    study: "요청·응답과 상태 코드 정리하기",
  },
  data: {
    foundation: "중복 제거와 분모를 복습하고 참여율 다시 집계하기",
    extend: "행사별 참여율을 그래프로 나타내기",
    study: "작은 표본의 참여율 해석과 한계 정리하기",
  },
  ai: {
    foundation: "Set과 정렬을 복습하고 근거 검색 다시 만들기",
    extend: "질문을 바꿔 근거 문서 검색 품질 비교하기",
    study: "키워드 검색과 검색 증강 생성의 관계 정리하기",
  },
  security: {
    foundation: "조건 분기를 복습하고 소유권 검사 다시 만들기",
    extend: "다른 사용자로 접근하는 권한 테스트 추가하기",
    study: "매 요청에서 권한을 확인해야 하는 이유 정리하기",
  },
  cloud: {
    foundation: "비율과 비교 연산을 복습하고 배포 판단 다시 만들기",
    extend: "배포 판단에 경계값 테스트 추가하기",
    study: "평균과 p95 응답 시간의 차이 정리하기",
  },
};
const trackTitles: Record<TrackId, string> = {
  frontend: "프론트엔드",
  backend: "백엔드",
  data: "데이터 분석",
  ai: "AI 엔지니어",
  security: "보안 엔지니어",
  cloud: "클라우드 / SRE",
};
export const actionCandidate = (
  kind: NextActionCandidate["kind"],
  track: TrackId,
): NextActionCandidate => ({
  id: `${kind}/${track}`,
  kind,
  track,
  title:
    kind === "explore"
      ? `${trackTitles[track]}의 작은 업무 체험하기`
      : kind === "broader"
        ? "코딩 밖에서도 흥미로운 학교 활동 한 가지 찾아보기"
        : kind === "review"
          ? "이번 체험에서 재미있거나 어려웠던 순간 정리하기"
          : activities[track][kind],
});
export type Ratings = Pick<Reflection, "interest" | "difficulty" | "again">;
export type RecommendationContext = NextActionPlan["context"];
export function nextActionSuggestion(
  ratings: Ratings,
  track: TrackId,
  context: RecommendationContext,
) {
  if (
    ![ratings.interest, ratings.difficulty, ratings.again].every(
      (v) => Number.isInteger(v) && v >= 1 && v <= 5,
    )
  )
    return null;
  const make = (
    ruleId: NextActionPlan["ruleId"],
    reason: string,
    candidates: NextActionCandidate[],
  ) => ({ ruleId, reason, candidates });
  if (ratings.interest >= 4 && ratings.difficulty >= 4)
    return make(
      "foundation-first",
      `흥미 ${ratings.interest}점·난이도 ${ratings.difficulty}점으로 답해, 기초를 보충한 뒤 같은 작업을 다시 제안해요.`,
      [actionCandidate("foundation", track)],
    );
  if (ratings.interest >= 4 && ratings.again >= 4)
    return make(
      "extend",
      `흥미 ${ratings.interest}점·재도전 의향 ${ratings.again}점으로 답해, 같은 분야의 작은 확장을 제안해요.`,
      [actionCandidate("extend", track)],
    );
  if (ratings.interest >= 4)
    return make(
      "study",
      `흥미 ${ratings.interest}점으로 답해, 같은 분야의 관련 주제를 제안해요.`,
      [actionCandidate("study", track)],
    );
  if (context.availableTracks.length)
    return make(
      "explore",
      `이번 흥미는 ${ratings.interest}점이에요. 아직 마치지 않은 다른 작업도 경험해볼 수 있어요.`,
      context.availableTracks.map((id) => actionCandidate("explore", id)),
    );
  if (context.completed.length === 6) {
    const highest = Math.max(...context.completed.map((c) => c.interest));
    if (highest <= 2)
      return make(
        "broader",
        "여섯 체험의 흥미 응답이 모두 2점 이하예요. 짧은 체험만으로 진로를 판단하지 않고, 학교의 다른 활동도 가볍게 탐색해보세요.",
        [actionCandidate("broader", track)],
      );
    return make(
      "revisit",
      "여섯 체험을 마쳤어요. 흥미를 가장 높게 답했던 체험의 확장을 제안해요. 동점이면 직접 골라주세요.",
      context.completed
        .filter((c) => c.interest === highest)
        .map((c) => actionCandidate("extend", c.track)),
    );
  }
  return make(
    "review",
    "다른 체험이 준비 중이거나 기록 기준을 확인해야 해요. 지금은 이번 경험을 정리하는 활동을 제안해요.",
    [actionCandidate("review", track)],
  );
}
