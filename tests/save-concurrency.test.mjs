import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  createStorage,
  RecordConflict,
  RecordDeleted,
} from "../lib/storage.ts";
import { createPersistence, DRAFT_KEY, readDraft } from "../lib/persistence.ts";
import { missions, initialProgress } from "../lib/missions.ts";
import { storageDates } from "../lib/retention.ts";
import { stateSchema } from "../lib/server.ts";
import { isCompleted } from "../lib/lab-state.ts";

const memory = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};
const initial = () =>
  stateSchema.parse({
    version: 1,
    progress: {
      frontend: initialProgress(missions[0]),
      backend: initialProgress(missions[1]),
    },
  });
const edit = (state, track, code) => ({
  ...state,
  progress: {
    ...state.progress,
    [track]: {
      ...state.progress[track],
      code,
      codeRevision: 1,
      codeSource: "user",
      updatedAt: new Date().toISOString(),
    },
  },
});

async function setup(t) {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const store = createStorage(
    async (sql, values) =>
      db.prepare(sql.replace(/\$\d+/g, "?")).all(...values),
    () => 1795392000000,
  );
  const seeded = initial();
  await store.save("guest", seeded);
  const shared = memory();
  const controllers = [];
  t.after(() => {
    controllers.forEach((c) => c.dispose());
    db.close();
  });
  async function fetcher(_url, options) {
    if (options.method === "POST") {
      try {
        const revision = options.headers["X-Lab-Revision"];
        const timestamp = await store.save(
          "guest",
          stateSchema.parse(JSON.parse(options.body)),
          revision === "new" ? null : Date.parse(revision),
        );
        return Response.json(storageDates(timestamp));
      } catch (error) {
        if (!(error instanceof RecordConflict)) throw error;
        const latest = await store.read("guest");
        return Response.json(
          {
            code: "RECORD_CONFLICT",
            state: latest.state,
            ...storageDates(latest.updatedAt),
          },
          { status: 409 },
        );
      }
    }
    const latest = await store.read("guest");
    return Response.json({
      state: latest.state,
      ...storageDates(latest.updatedAt),
    });
  }
  async function tab(tabStorage = memory()) {
    let state, status;
    const controller = createPersistence({
      storage: shared,
      tabStorage,
      fetcher,
      debounceMs: 100000,
      onState: (next) => {
        state = next;
      },
      onStatus: (next) => {
        status = next;
      },
    });
    controllers.push(controller);
    await controller.load();
    return {
      controller,
      tabStorage,
      get state() {
        return state;
      },
      get status() {
        return status;
      },
    };
  }
  return { store, seeded, shared, tab };
}

test("two tabs editing different existing missions preserve both edits", async (t) => {
  const f = await setup(t),
    a = await f.tab(),
    b = await f.tab();
  a.controller.stage(edit(a.state, "frontend", "A frontend"));
  b.controller.stage(edit(b.state, "backend", "B backend"));
  await a.controller.saveNow();
  await b.controller.saveNow();
  const saved = (await f.store.read("guest")).state;
  assert.equal(saved.progress.frontend.code, "A frontend");
  assert.equal(saved.progress.backend.code, "B backend");
  assert.equal(b.state.progress.frontend.code, "A frontend");
  assert.equal(b.status.phase, "saved");
});

for (const preference of ["local", "remote"])
  test(`same-mission conflicts require a choice; ${preference} preserves independent edits`, async (t) => {
    const f = await setup(t),
      a = await f.tab(),
      b = await f.tab();
    a.controller.stage(edit(a.state, "frontend", "server code"));
    const local = edit(
      edit(b.state, "frontend", "local code"),
      "backend",
      "local backend",
    );
    b.controller.stage(local);
    await a.controller.saveNow();
    await assert.rejects(b.controller.saveNow());
    assert.equal(b.status.phase, "conflict");
    assert.equal(b.status.canResolve, true);
    assert.equal(
      readDraft(b.tabStorage.getItem(DRAFT_KEY)).state.progress.frontend.code,
      "local code",
    );
    assert.equal(
      (await f.store.read("guest")).state.progress.frontend.code,
      "server code",
    );
    await b.controller.resolveConflict(preference);
    const saved = (await f.store.read("guest")).state;
    assert.equal(
      saved.progress.frontend.code,
      preference === "local" ? "local code" : "server code",
    );
    assert.equal(saved.progress.backend.code, "local backend");
    assert.equal(b.status.phase, "saved");
  });

test("a reload retains the tab's dirty draft even after another tab replaces the shared cache", async (t) => {
  const f = await setup(t),
    a = await f.tab(),
    b = await f.tab();
  b.controller.stage(edit(b.state, "frontend", "unsaved B"));
  a.controller.stage(edit(a.state, "frontend", "saved A"));
  await a.controller.saveNow();
  b.controller.dispose();
  const reloaded = await f.tab(b.tabStorage);
  assert.equal(reloaded.status.phase, "conflict");
  assert.equal(reloaded.state.progress.frontend.code, "unsaved B");
  await reloaded.controller.resolveConflict("local");
  assert.equal(
    (await f.store.read("guest")).state.progress.frontend.code,
    "unsaved B",
  );
});

test("same-millisecond writes have distinct revisions and stale or unversioned writes are rejected atomically", async (t) => {
  const f = await setup(t),
    first = await f.store.read("guest");
  const revised = edit(first.state, "frontend", "first writer");
  const second = await f.store.save("guest", revised, first.updatedAt);
  assert.equal(second, first.updatedAt + 1);
  await assert.rejects(
    f.store.save("guest", first.state, first.updatedAt),
    RecordConflict,
  );
  await assert.rejects(f.store.save("guest", first.state), RecordConflict);
  assert.equal(
    (await f.store.read("guest")).state.progress.frontend.code,
    "first writer",
  );
  await f.store.remove("guest");
  await assert.rejects(f.store.save("guest", revised, second), RecordDeleted);
});

test("game completion and optional interest persist alongside concurrent code edits without becoming code completion", async (t) => {
  const f = await setup(t),
    a = await f.tab(),
    b = await f.tab();
  const now = new Date().toISOString();
  a.controller.stage({
    ...a.state,
    games: {
      frontend: { version: 1, completedAt: now, updatedAt: now, interest: 4 },
    },
  });
  b.controller.stage(edit(b.state, "backend", "code still here"));
  await a.controller.saveNow();
  await b.controller.saveNow();
  const restored = await f.tab();
  assert.equal(restored.state.games.frontend.interest, 4);
  assert.equal(restored.state.progress.backend.code, "code still here");
  assert.equal(isCompleted(restored.state.progress.frontend), false);
  assert.equal(
    stateSchema.safeParse({
      ...restored.state,
      games: {
        frontend: { version: 1, completedAt: now, updatedAt: now, interest: 6 },
      },
    }).success,
    false,
  );
});
