import {
  getStorage,
  identity,
  json,
  readBody,
  sameOrigin,
} from "../../../lib/server";
import { coachInput, getHint } from "../../../lib/coach";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET() {
  return json({ available: !!process.env.OPENAI_API_KEY });
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return json({ error: "페이지를 새로고침하고 다시 시도해주세요." }, 403);
  let body;
  try {
    body = coachInput.parse(await readBody(req, 30000));
  } catch {
    return json({ error: "코드와 질문의 길이를 확인해주세요." }, 400);
  }
  try {
    const result = await getHint(body, identity(req).key, await getStorage(), {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    });
    return json(result);
  } catch {
    return json(
      { error: "기록 저장소에 연결하지 못했어요. 잠시 후 다시 시도해주세요." },
      503,
    );
  }
}
