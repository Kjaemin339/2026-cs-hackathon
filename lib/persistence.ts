import { emptyState, type LabState } from "./missions.ts";
import { normalizeLabState } from "./lab-state.ts";
import { mergeStates, sameValue } from "./state-merge.ts";
import { abortable } from "./async-deadline.ts";

export const DRAFT_KEY = "haebogi-lab-v1";
export type SaveStatus = {
  phase:
    | "loading"
    | "idle"
    | "saving"
    | "saved"
    | "error"
    | "recovery"
    | "conflict"
    | "deleting";
  ready: boolean;
  localSaved: boolean;
  savedAt: string | null;
  expiresAt: string | null;
  message: string;
  canResolve?: boolean;
};
type Draft = {
  format: 2;
  state: LabState;
  dirty: boolean;
  savedAt: string | null;
  expiresAt: string | null;
  base?: LabState;
};
type ServerRecord = {
  state: LabState | null;
  savedAt: string | null;
  expiresAt: string | null;
};
const fingerprint = (state: LabState) => JSON.stringify(state);
export const hasWork = (s: LabState) =>
  !!s.profile ||
  Object.values(s.progress).some(Boolean) ||
  Object.values(s.games ?? {}).some(Boolean);
export function readDraft(raw: string | null): Draft | null {
  try {
    const x = JSON.parse(raw ?? "null");
    const s = x?.format === 2 ? x.state : x;
    if (
      s?.version !== 1 ||
      !s.progress ||
      typeof s.progress !== "object" ||
      Array.isArray(s.progress)
    )
      return null;
    return {
      format: 2,
      state: normalizeLabState(s),
      dirty: x.format !== 2 || x.dirty !== false,
      savedAt: typeof x.savedAt === "string" ? x.savedAt : null,
      expiresAt: typeof x.expiresAt === "string" ? x.expiresAt : null,
      ...(x.base?.version === 1 && x.base?.progress
        ? { base: normalizeLabState(x.base) }
        : {}),
    };
  } catch {
    return null;
  }
}
// One queue owns autosave, coach pre-save and deletion. All status updates are
// tied to an epoch so late responses cannot revive a deleted or replaced draft.
export function createPersistence(options: {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  tabStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  onState: (state: LabState) => void;
  onStatus: (status: SaveStatus) => void;
  fetcher?: typeof fetch;
  debounceMs?: number;
  timeoutMs?: number;
}) {
  const fetcher = options.fetcher ?? fetch;
  let state = emptyState(),
    base = emptyState(),
    synced = fingerprint(state),
    active = false,
    epoch = 0,
    disposed = false;
  let conflictRemote: ServerRecord | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let status: SaveStatus = {
    phase: "loading",
    ready: false,
    localSaved: false,
    savedAt: null,
    expiresAt: null,
    message: "",
  };
  const emit = (patch: Partial<SaveStatus>) => {
    status = { ...status, ...patch };
    if (!disposed) options.onStatus({ ...status });
  };
  const cancelTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const request = (method: string, body?: LabState, signal?: AbortSignal) => {
    const deadline = AbortSignal.timeout(options.timeoutMs ?? 8000);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    return abortable(
      (async () => {
        const response = await fetcher("/api/state", {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(method === "POST"
              ? { "X-Lab-Revision": status.savedAt ?? "new" }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: combined,
        });
        const responseBody = await abortable(response.text(), combined);
        return new Response(responseBody, {
          status: response.status,
          headers: response.headers,
        });
      })(),
      combined,
    );
  };
  const writeLocal = () => {
    const raw = JSON.stringify({
      format: 2,
      state,
      dirty: fingerprint(state) !== synced,
      savedAt: status.savedAt,
      expiresAt: status.expiresAt,
      base,
    } satisfies Draft);
    // A tab's unsaved draft must survive another tab writing the shared cache.
    // Either storage can be unavailable independently (privacy mode or quota).
    let saved = false;
    for (const storage of [options.tabStorage, options.storage]) {
      if (!storage) continue;
      try {
        storage.setItem(DRAFT_KEY, raw);
        saved = true;
      } catch {
        /* Try the other backup. */
      }
    }
    emit({ localSaved: saved });
  };
  function enqueue(signal?: AbortSignal): Promise<Response> {
    const token = epoch;
    const job = tail
      .catch(() => {})
      .then(async () => {
        if (!active || token !== epoch || disposed)
          throw new Error("SAVE_CANCELED");
        emit({ phase: "saving", message: "" });
        try {
          // Read at execution time: an earlier queued save may have merged
          // another tab's edits while this job was waiting.
          let snapshot = state;
          let response = await request("POST", snapshot, signal);
          if (token !== epoch || disposed) throw new Error("SAVE_CANCELED");
          let data = await response.clone().json();
          for (
            let attempt = 0;
            response.status === 409 &&
            data.code === "RECORD_CONFLICT" &&
            data.state &&
            attempt < 3;
            attempt++
          ) {
            const remote = normalizeLabState(data.state);
            const merged = mergeStates(base, state, remote);
            if (merged.conflicts.length) {
              conflictRemote = {
                state: remote,
                savedAt: data.savedAt,
                expiresAt: data.expiresAt,
              };
              active = false;
              cancelTimer();
              emit({
                phase: "conflict",
                ready: false,
                canResolve: true,
                message: `${merged.conflicts.join(", ")}을 두 탭에서 수정했어요. 겹친 변경 중 유지할 내용을 골라주세요. 다른 과제의 변경은 모두 보존해요.`,
              });
              writeLocal();
              throw new Error("SAVE_CONFLICT");
            }
            base = remote;
            synced = fingerprint(base);
            state = merged.state;
            options.onState(state);
            emit({ savedAt: data.savedAt, expiresAt: data.expiresAt });
            writeLocal();
            snapshot = state;
            response = await request("POST", snapshot, signal);
            if (token !== epoch || disposed) throw new Error("SAVE_CANCELED");
            data = await response.clone().json();
          }
          if (!response.ok) {
            if (response.status === 409) {
              active = false;
              emit({
                phase: "conflict",
                ready: false,
                canResolve: false,
                message:
                  data.error ??
                  "기록 기준이 달라요. 초안을 내려받고 새로고침해주세요.",
              });
            }
            throw new Error("SAVE_FAILED");
          }
          if (!data.savedAt || !data.expiresAt)
            throw new Error("INVALID_SAVE_RECEIPT");
          synced = fingerprint(snapshot);
          base = snapshot;
          emit({ savedAt: data.savedAt, expiresAt: data.expiresAt });
          writeLocal();
          if (fingerprint(state) === synced)
            emit({ phase: "saved", message: "" });
          return response;
        } catch (error) {
          if (token === epoch && !disposed && status.phase !== "conflict")
            emit({
              phase: "error",
              message: "서버에 저장하지 못했어요. 연결 후 다시 시도해주세요.",
            });
          throw error;
        }
      });
    tail = job.catch(() => {});
    return job;
  }
  const api = {
    async load() {
      const token = ++epoch;
      active = false;
      cancelTimer();
      let draft: Draft | null = null;
      try {
        draft = readDraft(options.tabStorage?.getItem(DRAFT_KEY) ?? null);
      } catch {
        /* Storage may be unavailable. */
      }
      if (!draft?.dirty) {
        try {
          draft = readDraft(options.storage.getItem(DRAFT_KEY)) ?? draft;
        } catch {
          /* Retain any tab backup. */
        }
      }
      if (draft) {
        state = draft.state;
        base = draft.base ?? emptyState();
        options.onState(state);
      }
      emit({
        phase: "loading",
        ready: false,
        localSaved: !!draft,
        savedAt: draft?.savedAt ?? null,
        expiresAt: draft?.expiresAt ?? null,
        message: "",
        canResolve: false,
      });
      try {
        const response = await request("GET");
        if (!response.ok) throw new Error("LOAD_FAILED");
        const remote = (await response.json()) as ServerRecord;
        if (token !== epoch || disposed) return;
        emit({ savedAt: remote.savedAt, expiresAt: remote.expiresAt });
        if (!remote.state && draft && hasWork(draft.state)) {
          emit({
            phase: "recovery",
            ready: false,
            message:
              "서버 기록이 없거나 만료됐어요. 기기 초안을 다시 저장할까요?",
          });
          return;
        }
        const remoteState = remote.state
          ? normalizeLabState(remote.state)
          : emptyState();
        if (draft?.dirty) {
          // Old caches have no base. Only a matching receipt proves that the
          // fetched server state is their base; otherwise ask on overlap.
          const draftBase =
            draft.base ??
            (draft.savedAt === remote.savedAt ? remoteState : emptyState());
          const merged = mergeStates(draftBase, draft.state, remoteState);
          if (merged.conflicts.length) {
            base = draftBase;
            conflictRemote = remote;
            emit({
              phase: "conflict",
              ready: false,
              canResolve: true,
              message: `${merged.conflicts.join(", ")}의 기기 초안과 서버 기록이 달라요. 겹친 변경 중 유지할 내용을 골라주세요.`,
            });
            return;
          }
          state = merged.state;
        } else state = remoteState;
        base = remoteState;
        synced = fingerprint(remoteState);
        active = true;
        options.onState(state);
        emit({
          phase: remote.savedAt ? "saved" : "idle",
          ready: true,
          message: "",
        });
        if (hasWork(state)) writeLocal();
        if (fingerprint(state) !== synced) api.stage(state);
      } catch {
        if (token === epoch && !disposed)
          emit({
            phase: "error",
            ready: !!draft,
            message: draft
              ? "서버 기록을 확인하지 못했어요. 기기 초안은 계속 편집할 수 있어요."
              : "서버 기록을 확인하지 못했어요. 연결 후 다시 시도해주세요.",
          });
      }
    },
    stage(next: LabState) {
      if (
        disposed ||
        status.phase === "deleting" ||
        status.phase === "recovery" ||
        status.phase === "conflict" ||
        status.phase === "loading"
      )
        return;
      state = next;
      if (fingerprint(next) === synced) return;
      writeLocal();
      cancelTimer();
      if (!active) return;
      emit({ phase: "saving", message: "" });
      timer = setTimeout(() => {
        void enqueue().catch(() => {});
      }, options.debounceMs ?? 900);
    },
    saveNow(signal?: AbortSignal) {
      cancelTimer();
      return enqueue(signal);
    },
    async resolveConflict(preference: "local" | "remote") {
      if (!conflictRemote?.state || status.phase !== "conflict") return;
      const remote = conflictRemote;
      state = mergeStates(base, state, remote.state!, preference).state;
      base = remote.state!;
      synced = fingerprint(base);
      conflictRemote = null;
      active = true;
      options.onState(state);
      emit({
        phase: "saved",
        ready: true,
        canResolve: false,
        message: "",
        savedAt: remote.savedAt,
        expiresAt: remote.expiresAt,
      });
      writeLocal();
      if (!sameValue(state, base)) await api.saveNow().catch(() => {});
    },
    async retry() {
      if (!active) return api.load();
      await api.saveNow().catch(() => {});
    },
    async restore() {
      if (status.phase !== "recovery") return;
      active = true;
      base = emptyState();
      synced = "";
      emit({ phase: "saving", ready: true, message: "" });
      writeLocal();
      await api.saveNow().catch(() => {});
    },
    async remove() {
      if (status.phase === "deleting") return false;
      const token = ++epoch;
      active = false;
      cancelTimer();
      emit({ phase: "deleting", ready: false, message: "" });
      try {
        await tail;
        const response = await request("DELETE");
        if (!response.ok) throw new Error("DELETE_FAILED");
        if (token !== epoch || disposed) return false;
        // Keep deletion locked if this browser cannot remove its own draft.
        options.storage.removeItem(DRAFT_KEY);
        options.tabStorage?.removeItem(DRAFT_KEY);
        state = emptyState();
        base = state;
        conflictRemote = null;
        synced = fingerprint(state);
        options.onState(state);
        active = true;
        emit({
          phase: "idle",
          canResolve: false,
          ready: true,
          localSaved: false,
          savedAt: null,
          expiresAt: null,
          message: "",
        });
        return true;
      } catch {
        if (token === epoch && !disposed)
          emit({
            phase: "error",
            ready: false,
            message:
              "삭제를 완료하지 못했어요. 초안을 유지했으니 다시 시도해주세요.",
          });
        return false;
      }
    },
    externalReset() {
      ++epoch;
      active = false;
      cancelTimer();
      state = emptyState();
      base = state;
      conflictRemote = null;
      try {
        options.tabStorage?.removeItem(DRAFT_KEY);
      } catch {
        /* The server deletion fence still blocks stale writes. */
      }
      synced = fingerprint(state);
      options.onState(state);
      emit({
        phase: "conflict",
        canResolve: false,
        ready: false,
        localSaved: false,
        savedAt: null,
        expiresAt: null,
        message:
          "다른 탭에서 기록을 삭제했어요. 새로고침해 새 체험을 시작해주세요.",
      });
    },
    dispose() {
      disposed = true;
      ++epoch;
      active = false;
      cancelTimer();
    },
  };
  return api;
}
