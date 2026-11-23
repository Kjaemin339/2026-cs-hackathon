import type { Mission, Progress } from "./missions.ts";
import { CONTENT_VERSION, releaseMissions } from "./content/2026-11-23.1.ts";
export type MissionRelease = {
  version: string;
  reviewStatus: "draft" | "reviewed";
  reviewedAt: string | null;
  acceptingNewStarts: boolean;
  pausedMissionIds?: Mission["id"][];
  missions: Mission[];
};
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function createMissionCatalog(
  releases: MissionRelease[],
  activeVersion: string,
) {
  if (new Set(releases.map((r) => r.version)).size !== releases.length)
    throw Error("DUPLICATE_CONTENT_VERSION");
  for (const r of releases) {
    if (
      r.missions.some((m) => m.contentVersion !== r.version) ||
      new Set(r.missions.map((m) => m.id)).size !== r.missions.length
    )
      throw Error("INVALID_CONTENT_RELEASE");
    if (r.reviewStatus === "reviewed" && !r.reviewedAt)
      throw Error("REVIEW_DATE_REQUIRED");
  }
  // Clone before freezing so caller-owned fixtures/authoring data are untouched.
  const registry = freeze(structuredClone(releases));
  const release = (version: string) =>
    registry.find((r) => r.version === version);
  const active = release(activeVersion);
  if (!active) throw Error("ACTIVE_CONTENT_NOT_FOUND");
  return {
    list: () => active.missions,
    resolve: (id: string, version = activeVersion) => {
      const r = release(version);
      return r?.reviewStatus === "reviewed"
        ? r.missions.find((m) => m.id === id)
        : undefined;
    },
    canStart: (id: string) =>
      !active.pausedMissionIds?.some((paused) => paused === id) &&
      active.reviewStatus === "reviewed" &&
      active.acceptingNewStarts &&
      active.missions.some((m) => m.id === id),
    start: (id: string) =>
      active.reviewStatus === "reviewed" &&
      active.acceptingNewStarts &&
      !active.pausedMissionIds?.some((paused) => paused === id)
        ? active.missions.find((m) => m.id === id)
        : undefined,
  };
}
export const LEGACY_CONTENT_VERSION = CONTENT_VERSION;
export const missionCatalog = createMissionCatalog(
  [
    {
      version: CONTENT_VERSION,
      reviewStatus: "reviewed",
      reviewedAt: "2026-11-23",
      acceptingNewStarts: true,
      missions: releaseMissions,
    },
  ],
  CONTENT_VERSION,
);
export const missions = missionCatalog.list();
export const missionById = missionCatalog.resolve;
export const canStartMission = missionCatalog.canStart;
export const missionForProgress = (id: string, progress: Progress) =>
  missionById(id, progress.contentVersion ?? LEGACY_CONTENT_VERSION);
