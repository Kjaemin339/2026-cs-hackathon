import type { Mission, TrackId } from "../missions.ts";
import { releaseMissions as baseline } from "./2026-11-23.1.ts";

export const CONTENT_VERSION = "2026-11-23.2";
const practice: Record<TrackId, NonNullable<Mission["practice"]>> = {
  frontend: {
    firstAction:
      "화면의 필터는 준비돼 있어요. TODO 줄에서 마감된 행사를 목록에 남길지 바꿔보세요.",
    focus: "if (availableOnly && !hasRoom)",
    example: {
      input: "신청 가능 필터 켜기 · 신청 20명 / 정원 20명",
      outcome: "자리가 없으므로 목록에서 빠져요.",
    },
    primer:
      "filter 안에서 true를 반환하면 남기고 false면 빼요.\n// 예: [1, 2, 3].filter(n => n < 3) → [1, 2]",
  },
  backend: {
    firstAction:
      "응답과 중복 확인은 준비돼 있어요. TODO 줄에서 신청 인원이 정원과 같을 때도 마감되는지 확인해보세요.",
    focus: "if (attendees.length > capacity)",
    example: {
      input: "정원 2명 · 이미 신청한 사람 2명 · 새 신청 1명",
      outcome: "자리가 없어요. 403과 accepted: false로 거절해요.",
    },
    primer:
      "length는 배열에 들어 있는 사람 수예요.\n>  : 더 클 때만 참\n>= : 같거나 더 클 때 참\n201 = 신청 완료 / 409 = 중복 / 403 = 마감",
  },
  data: {
    firstAction:
      "취소·중복 제거와 묶기는 준비돼 있어요. TODO 줄의 참여율 계산만 바꿔보세요.",
    focus: "rate: 0",
    example: {
      input: "유효 신청 2명 중 실제 참여 1명",
      outcome: "1 ÷ 2 × 100 = 참여율 50%예요.",
    },
    primer:
      "total = 유효 신청 수 / attended = 실제 참여 수\nMath.round(66.7) → 67\n// 비율에 100을 곱하면 퍼센트가 돼요.",
  },
  ai: {
    firstAction:
      "단어 세기와 정렬은 준비돼 있어요. TODO 줄에서 겹치는 단어가 0개인 문서를 빼보세요.",
    focus: "filter(doc => doc.score >= 0)",
    example: {
      input: "질문: 신청 · 문서 단어: 장소",
      outcome: "겹치는 단어 0개. AI에게 건네는 근거에서 제외해요.",
    },
    primer:
      "score = 질문과 겹치는 단어 수예요.\nfilter는 조건이 참인 문서만 남겨요.\n// 점수가 같을 때 정렬하는 부분은 이미 준비돼 있어요.",
  },
  security: {
    firstAction:
      "로그인과 본인 확인은 준비돼 있어요. TODO 줄의 관리자 예외를 조회할 때만 허용해보세요.",
    focus: "if (user.role === 'admin')",
    example: {
      input: "관리자가 다른 사람의 기록을 삭제하려고 해요.",
      outcome: "관리자도 다른 사람의 기록은 삭제할 수 없어요. 403을 반환해요.",
    },
    primer:
      "action은 'read'(조회) 또는 'delete'(삭제)예요.\nA && B는 두 조건이 모두 맞아야 참이에요.\n200 = 허용 / 401 = 로그인 필요 / 403 = 권한 없음",
  },
  cloud: {
    firstAction:
      "데이터 수와 오류율 계산은 준비돼 있어요. TODO 줄에서 오류가 많거나 응답이 느리면 되돌리도록 바꿔보세요.",
    focus: "errorRate > 0.02 && metrics.p95Ms > 500",
    example: {
      input: "요청 500건 · 오류 15건(3%) · 응답 320ms",
      outcome: "빠르더라도 오류가 많으므로 rollback(되돌리기)이에요.",
    },
    primer:
      "&& = 두 조건 모두 / || = 둘 중 하나라도\np95Ms = 요청 100개 중 약 95개가 이 시간 안에 응답해요.\nwait = 더 관찰 / rollback = 되돌리기 / promote = 계속 배포",
  },
};

function scaffold(m: Mission) {
  switch (m.id) {
    case "frontend":
      return m.solution.replace(
        "    return matches && (!availableOnly || hasRoom);",
        "    if (!matches) return false;\n    // TODO: 마감된 행사를 남길지 정해보세요.\n    if (availableOnly && !hasRoom) return true;\n    return true;",
      );
    case "backend":
      return m.solution.replace(
        "  if (attendees.length >= capacity) {",
        "  // TODO: 인원이 정원과 같아도 마감이에요.\n  if (attendees.length > capacity) {",
      );
    case "data":
      return m.solution.replace(
        "    rate: Math.round(groups[category].attended / groups[category].total * 100)",
        "    // TODO: 참여율을 계산해보세요. 나머지 집계는 준비돼 있어요.\n    rate: 0",
      );
    case "ai":
      return m.solution
        .replace(
          "  return docs.map",
          "  // TODO: 아래 filter에서 관련 없는 문서를 빼보세요.\n  return docs.map",
        )
        .replace(
          "filter(doc => doc.score > 0)",
          "filter(doc => doc.score >= 0)",
        );
    case "security":
      return m.solution.replace(
        "  if (user.role === 'admin' && action === 'read') return 200;",
        "  // TODO: 관리자는 다른 사람의 기록을 조회만 할 수 있어요.\n  if (user.role === 'admin') return 200;",
      );
    case "cloud":
      return m.solution.replace(
        "  if (errorRate > 0.02 || metrics.p95Ms > 500)",
        "  // TODO: 둘 중 하나만 나빠져도 되돌려요.\n  if (errorRate > 0.02 && metrics.p95Ms > 500)",
      );
  }
}

// Only entry scaffolds and their explanation change. The original job rules,
// reference solutions, five checks, reviewed hints and citations stay intact.
export const releaseMissions: Mission[] = baseline.map((m) => ({
  ...m,
  contentVersion: CONTENT_VERSION,
  starter: scaffold(m),
  time: "10분",
  practice: practice[m.id],
}));
