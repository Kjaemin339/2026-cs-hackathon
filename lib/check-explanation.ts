import type { Mission, TrackId } from "./missions.ts";
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const short = (value: unknown) => {
  try {
    return (JSON.stringify(value) ?? "반환값 없음").slice(0, 600);
  } catch {
    return "표시할 수 없는 값";
  }
};
const text = (value: unknown) =>
  typeof value === "string"
    ? value.slice(0, 80)
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : value == null
        ? "?"
        : short(value).slice(0, 80);
const releaseLabels = new Map<unknown, string>([
  ["wait", "조금 더 관찰해요 (wait)"],
  ["rollback", "이전 버전으로 되돌려요 (rollback)"],
  ["promote", "배포를 계속해요 (promote)"],
]);
const accessLabels = new Map<unknown, string>([
  [200, "허용 (200)"],
  [401, "로그인 필요 (401)"],
  [403, "접근 거절 (403)"],
]);
export function describeResult(track: TrackId, value: unknown): string {
  if (track === "cloud") return releaseLabels.get(value) ?? short(value);
  if (track === "security") return accessLabels.get(value) ?? short(value);
  if (
    track === "frontend" &&
    Array.isArray(value) &&
    value.every((x) => typeof object(x)?.title === "string")
  )
    return value.length
      ? `${value.length}개 행사\n` +
          value
            .slice(0, 6)
            .map((x) => `• ${text(x.title)}`)
            .join("\n")
      : "조건에 맞는 행사 없음";
  if (
    track === "ai" &&
    Array.isArray(value) &&
    value.every((x) => typeof x === "number")
  )
    return value.length
      ? value
          .slice(0, 10)
          .map((x) => `문서 ${x}`)
          .join(", ")
      : "관련 문서 없음";
  if (track === "backend") {
    const x = object(value);
    if (x && typeof x.status === "number" && typeof x.accepted === "boolean")
      return `${x.accepted ? "신청을 받아요" : "신청을 거절해요"} · 응답 ${x.status}`;
  }
  if (
    track === "data" &&
    Array.isArray(value) &&
    value.every((x) => typeof object(x)?.category === "string")
  )
    return value.length
      ? value
          .slice(0, 6)
          .map(
            (x) =>
              `${text(x.category)}: 신청 ${text(x.total)}명 중 참여 ${text(x.attended)}명 (${text(x.rate)}%)`,
          )
          .join("\n")
      : "집계할 기록 없음";
  return short(value);
}
export function describeInput(mission: Mission, index: number): string {
  const args = mission.tests[index]?.args;
  if (!args) return "입력을 확인할 수 없어요.";
  const [a, b, c] = args;
  if (mission.id === "frontend")
    return `${text(b)} 카테고리 · 신청 가능 필터 ${c ? "켜짐" : "꺼짐"} · 행사 ${Array.isArray(a) ? a.length : "?"}개`;
  if (mission.id === "backend")
    return `신청자 ${text(b)} · 기존 신청 ${Array.isArray(a) ? a.length : "?"}명 · 정원 ${text(c)}명`;
  if (mission.id === "data")
    return `입장 기록 ${Array.isArray(a) ? a.length : "?"}건 · 취소와 중복을 정리해요.`;
  if (mission.id === "ai")
    return `질문 단어: ${Array.isArray(a) && a.length ? a.map(text).join(", ") : "없음"} · 후보 문서 ${Array.isArray(b) ? b.length : "?"}개`;
  if (mission.id === "security") {
    const user = object(a),
      record = object(b);
    return `${user ? `${text(user.id)}${user.role === "admin" ? "(관리자)" : "(참가자)"}` : "로그인 안 함"} · 기록 주인 ${text(record?.ownerId)} · ${c === "read" ? "조회" : "삭제"} 요청`;
  }
  const metrics = object(a);
  return `요청 ${text(metrics?.requests)}건 · 오류 ${text(metrics?.errors)}건 · p95 응답 ${text(metrics?.p95Ms)}ms`;
}
