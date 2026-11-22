export const COACH_TIMEOUT_MS = 15000;
export class DeadlineExceeded extends Error {
  constructor() {
    super("AI 요청 시간이 초과됐어요.");
    this.name = "DeadlineExceeded";
  }
}
// Race even a non-cooperative dependency; always observe its eventual rejection.
export function abortable<T>(
  pending: PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException("Canceled", "AbortError"));
    };
    Promise.resolve(pending).then(
      (value) => {
        cleanup();
        if (!signal.aborted) resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}
export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const cancel = () =>
    controller.abort(
      options.signal?.reason ?? new DOMException("Canceled", "AbortError"),
    );
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DeadlineExceeded()),
    options.timeoutMs ?? COACH_TIMEOUT_MS,
  );
  try {
    controller.signal.throwIfAborted();
    return await abortable(
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
      controller.signal,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
