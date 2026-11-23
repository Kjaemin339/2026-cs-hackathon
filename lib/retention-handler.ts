import { timingSafeEqual } from "node:crypto";
import type { LabStorage } from "./storage.ts";

export async function cleanupRequest(
  req: Request,
  secret: string | undefined,
  storage: () => Promise<LabStorage>,
) {
  const reply = (body: unknown, status: number) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!secret || secret.length < 32)
    return reply({ error: "Cleanup is not configured" }, 503);
  const expected = Buffer.from(`Bearer ${secret}`),
    received = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return reply({ error: "Unauthorized" }, 401);
  try {
    return reply({ deleted: await (await storage()).cleanup() }, 200);
  } catch {
    return reply({ error: "Cleanup failed" }, 503);
  }
}
