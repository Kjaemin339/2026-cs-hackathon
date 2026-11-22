import type { CoachInput } from "./coach.ts";
import type { LabState } from "./missions.ts";
import { abortable, withDeadline } from "./async-deadline.ts";
export type CoachReply = {
  source: "ai" | "guide";
  message: string;
  notice?: string;
  trace?: string[];
  nextAction?: string;
  guideId?: string;
  references?: { id: string; label: string; kind: "requirement" | "check" }[];
};
export function requestCoach(
  body: CoachInput,
  options: {
    state: LabState;
    waitForSave: Promise<unknown>;
    signal: AbortSignal;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<CoachReply> {
  const fetcher = options.fetcher ?? fetch;
  return withDeadline(async (signal) => {
    await abortable(options.waitForSave, signal);
    signal.throwIfAborted();
    const saved = await abortable(
      fetcher("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options.state),
        signal,
      }),
      signal,
    );
    if (!saved.ok) throw new Error("STATE_SAVE_FAILED");
    signal.throwIfAborted();
    const response = await abortable(
      fetcher("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
      signal,
    );
    const data = (await abortable(response.json(), signal)) as CoachReply;
    if (
      !response.ok ||
      typeof data.message !== "string" ||
      !["ai", "guide"].includes(data.source)
    )
      throw new Error("INVALID_COACH_REPLY");
    return data;
  }, options);
}
