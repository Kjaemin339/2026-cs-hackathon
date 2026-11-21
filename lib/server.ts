import { z } from "zod";
export { getStorage } from "./storage.ts";

const test = z.object({
  label: z.string().max(200),
  passed: z.boolean(),
  why: z.string().max(600),
  actual: z.unknown().optional(),
  expected: z.unknown().optional(),
  error: z.string().max(1000).optional(),
});
const reflection = z.object({
  interest: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  again: z.number().int().min(1).max(5),
  note: z.string().max(2000),
  next: z.string().max(300),
  endedAt: z.string().datetime(),
});
const progress = z.object({
  version: z.literal(1),
  code: z.string().max(20000),
  runs: z.number().int().min(0).max(100000),
  hintLevel: z.number().int().min(0).max(3),
  usedSolution: z.boolean(),
  result: z
    .object({
      tests: z.array(test).max(5),
      preview: z.unknown(),
      error: z.string().max(2000).optional(),
    })
    .optional(),
  reflection: reflection.optional(),
  updatedAt: z.string().datetime(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  profile: z
    .object({
      experience: z.string().max(120),
      purpose: z.string().max(200),
      aiConsent: z.boolean(),
    })
    .optional(),
  progress: z.object({
    frontend: progress.optional(),
    backend: progress.optional(),
    data: progress.optional(),
    ai: progress.optional(),
    security: progress.optional(),
    cloud: progress.optional(),
  }),
});
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export function sameOrigin(req: Request) {
  try {
    const raw = req.headers.get("Origin");
    if (!raw) return false;
    const origin = new URL(raw);
    // Next may normalize req.url to an internal hostname. Host retains the
    // browser-facing authority; browsers cannot forge Host on a cross-site POST.
    const host = req.headers.get("host") ?? new URL(req.url).host;
    return (
      raw === origin.origin &&
      origin.host === host &&
      (process.env.NODE_ENV === "production"
        ? origin.protocol === "https:"
        : ["https:", "http:"].includes(origin.protocol)) &&
      !!req.headers.get("Content-Type")?.includes("application/json")
    );
  } catch {
    return false;
  }
}
export function identity(req: Request) {
  // Vercel does not authenticate the Sites headers. Never trust them as identity.
  const secure = process.env.NODE_ENV === "production";
  const name = secure ? "__Host-lab_session" : "lab_session";
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
  const valid =
    raw &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      raw,
    );
  const id = valid ? raw : crypto.randomUUID();
  return {
    key: "guest:" + id,
    cookie: valid
      ? ""
      : `${name}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure ? "; Secure" : ""}`,
  };
}
export async function readBody(req: Request, limit = 100000) {
  const raw = await req.text();
  if (raw.length > limit)
    throw new Error("입력이 너무 길어요. 코드를 줄여주세요.");
  return JSON.parse(raw);
}
