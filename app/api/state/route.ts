import {
  getStorage,
  identity,
  json,
  readBody,
  sameOrigin,
  stateSchema,
} from "../../../lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const id = identity(req);
  try {
    const store = await getStorage();
    const saved = await store.read(id.key);
    return json(
      { state: saved?.state ?? null },
      200,
      id.cookie ? { "Set-Cookie": id.cookie } : {},
    );
  } catch {
    return json(
      {
        error: "저장소에 연결하지 못했어요. 이 기기에 초안을 보관하고 있어요.",
      },
      503,
      id.cookie ? { "Set-Cookie": id.cookie } : {},
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return json({ error: "같은 페이지에서 다시 시도해주세요." }, 403);
  const id = identity(req);
  let state;
  try {
    state = stateSchema.parse(await readBody(req));
  } catch {
    return json({ error: "저장할 내용의 형식이나 길이를 확인해주세요." }, 400);
  }
  try {
    const store = await getStorage();
    await store.save(id.key, state);
    return json(
      { savedAt: new Date().toISOString() },
      200,
      id.cookie ? { "Set-Cookie": id.cookie } : {},
    );
  } catch {
    return json(
      { error: "저장하지 못했어요. 연결 후 다시 시도해주세요." },
      503,
    );
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req))
    return json({ error: "같은 페이지에서 다시 시도해주세요." }, 403);
  try {
    await (await getStorage()).remove(identity(req).key);
    return json({ deleted: true });
  } catch {
    return json(
      { error: "기록을 삭제하지 못했어요. 연결 후 다시 시도해주세요." },
      503,
    );
  }
}
