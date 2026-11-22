import type {
  ExecutionSnapshot,
  LabState,
  Mission,
  Profile,
  Progress,
  RunResult,
} from "./missions.ts";

type AnswerField = "experience" | "purpose";
const sourceKey = (field: AnswerField) => `${field}Source` as const;
export function normalizeProfile(input: unknown): Profile {
  const raw = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const answer = (field: AnswerField) => {
    const value =
      typeof raw[field] === "string" ? (raw[field] as string).trim() : null;
    const source = raw[sourceKey(field)];
    if (value && source === "self_reported")
      return { value, source: "self_reported" as const };
    if (value && source !== "unknown")
      return { value, source: "legacy_unverified" as const };
    return { value: null, source: "unknown" as const };
  };
  const experience = answer("experience"),
    purpose = answer("purpose");
  return {
    experience: experience.value,
    experienceSource: experience.source,
    purpose: purpose.value,
    purposeSource: purpose.source,
    aiConsent: raw.aiConsent === true,
  };
}
export function profileAnswer(
  profile: unknown,
  field: AnswerField,
): string | null {
  const normalized = normalizeProfile(profile);
  return normalized[sourceKey(field)] === "self_reported"
    ? normalized[field]
    : null;
}
export function profileAnswerLabel(
  profile: unknown,
  field: AnswerField,
): string {
  const normalized = normalizeProfile(profile);
  return (
    profileAnswer(normalized, field) ??
    (normalized[sourceKey(field)] === "legacy_unverified"
      ? "이전 기록 · 미확인"
      : "미응답")
  );
}
export function updateProfileAnswer(
  profile: unknown,
  field: AnswerField,
  value: string,
): Profile {
  return {
    ...normalizeProfile(profile),
    [field]: value.trim() || null,
    [sourceKey(field)]: value.trim() ? "self_reported" : "unknown",
  };
}
export function normalizeLabState(state: LabState): LabState {
  return {
    ...state,
    ...(state.profile ? { profile: normalizeProfile(state.profile) } : {}),
    progress: Object.fromEntries(
      Object.entries(state.progress).map(([id, p]) => [
        id,
        p
          ? {
              ...p,
              codeRevision: p.codeRevision ?? 0,
              codeSource: p.codeSource ?? "legacy",
            }
          : p,
      ]),
    ),
  };
}
export function changeCode(
  progress: Progress,
  code: string,
  source: "user" | "reference" | "starter",
): Partial<Progress> {
  return {
    code,
    codeRevision: (progress.codeRevision ?? 0) + 1,
    codeSource: source,
    result: undefined,
  };
}
export function currentExecution(
  progress: Progress,
): ExecutionSnapshot | undefined {
  return progress.lastExecution?.revision === (progress.codeRevision ?? 0)
    ? progress.lastExecution
    : undefined;
}
export function canRecordAttempt(progress: Progress): boolean {
  return currentExecution(progress)?.kind === "edited";
}
export function isCompleted(progress: Progress | undefined): boolean {
  return progress?.reflection?.execution?.kind === "edited";
}
export function recordStatus(progress: Progress): string {
  if (isCompleted(progress)) return "체험 완료";
  if (progress.reflection) return "이전 기록 · 실행 미확인";
  return "진행 중";
}
export async function snapshotExecution(
  progress: Progress,
  mission: Mission,
  result: RunResult,
  executedAt: string,
  previewArgs: unknown[] = mission.previewArgs,
): Promise<ExecutionSnapshot> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(progress.code),
  );
  const kind =
    progress.code === mission.starter
      ? "starter"
      : progress.codeSource === "user"
        ? "edited"
        : progress.codeSource === "reference"
          ? "reference"
          : "unverified";
  return {
    id: crypto.randomUUID(),
    codeHash: Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    revision: progress.codeRevision ?? 0,
    kind,
    executedAt,
    previewArgs,
    result,
  };
}
