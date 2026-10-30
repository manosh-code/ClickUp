import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Database } from "bun:sqlite";
import {
  createBoard,
  createCard,
  createList,
  deleteBoard,
  deleteCard,
  deleteList,
  getBoardDetail,
  listBoards,
  saveOrder,
  updateBoard,
  updateCard,
  updateList,
} from "./db";

const ALLOWED_LABELS = new Set(["bug", "feature", "design", "urgent"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  if (title.length === 0 || title.length > 120) return null;
  return title;
}

function parseColor(value: unknown): string | null {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) return null;
  return value.toLowerCase();
}

function parseDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const description = value.trim();
  if (description.length > 4000) return null;
  return description;
}

function parseLabels(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const labels: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !ALLOWED_LABELS.has(item) || labels.includes(item)) return null;
    labels.push(item);
  }
  return labels;
}

export function createApp(db: Database): Hono {
  const app = new Hono();
  app.use("/api/*", cors());

  app.get("/api/boards", (c) => c.json(listBoards(db)));

  app.post("/api/boards", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) return c.json({ error: "Invalid body" }, 400);
    const title = parseTitle(body.title);
    const color = parseColor(body.color);
    if (!title) return c.json({ error: "Title is required" }, 400);
    if (!color) return c.json({ error: "Color must be a hex value" }, 400);
    return c.json(createBoard(db, title, color), 201);
  });

  app.get("/api/boards/:id", (c) => {
    const board = getBoardDetail(db, c.req.param("id"));
    if (!board) return c.json({ error: "Board not found" }, 404);
    return c.json(board);
  });

  app.patch("/api/boards/:id", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) return c.json({ error: "Invalid body" }, 400);
    const patch: { title?: string; color?: string } = {};
    if ("title" in body) {
      const title = parseTitle(body.title);
      if (!title) return c.json({ error: "Title is required" }, 400);
      patch.title = title;
    }
    if ("color" in body) {
      const color = parseColor(body.color);
      if (!color) return c.json({ error: "Color must be a hex value" }, 400);
      patch.color = color;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "Nothing to update" }, 400);
    const board = updateBoard(db, c.req.param("id"), patch);
    if (!board) return c.json({ error: "Board not found" }, 404);
    return c.json(board);
  });

  app.delete("/api/boards/:id", (c) => {
    if (!deleteBoard(db, c.req.param("id"))) return c.json({ error: "Board not found" }, 404);
    return c.body(null, 204);
  });

  app.post("/api/boards/:id/lists", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) return c.json({ error: "Invalid body" }, 400);
    const title = parseTitle(body.title);
    if (!title) return c.json({ error: "Title is required" }, 400);
    const list = createList(db, c.req.param("id"), title);
    if (!list) return c.json({ error: "Board not found" }, 404);
    return c.json(list, 201);
  });

  app.put("/api/boards/:id/order", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body) || !Array.isArray(body.listIds) || !isRecord(body.cardIdsByList)) {
      return c.json({ error: "Invalid order" }, 400);
    }
    const listIds: string[] = [];
    for (const id of body.listIds) {
      if (typeof id !== "string") return c.json({ error: "Invalid order" }, 400);
      listIds.push(id);
    }
    const cardIdsByList: Record<string, string[]> = {};
    for (const [listId, cardIds] of Object.entries(body.cardIdsByList)) {
      if (!Array.isArray(cardIds)) return c.json({ error: "Invalid order" }, 400);
      const ids: string[] = [];
      for (const cardId of cardIds) {
        if (typeof cardId !== "string") return c.json({ error: "Invalid order" }, 400);
        ids.push(cardId);
      }
      cardIdsByList[listId] = ids;
    }

    const result = saveOrder(db, c.req.param("id"), listIds, cardIdsByList);
    switch (result.status) {
      case "ok":
        return c.json(result.board);
      case "not_found":
        return c.json({ error: "Board not found" }, 404);
      case "invalid":
        return c.json({ error: "Invalid order" }, 400);
      default: {
        const exhaustive: never = result;
        return exhaustive;
      }
    }
  });

  app.patch("/api/lists/:id", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) return c.json({ error: "Invalid body" }, 400);
    const title = parseTitle(body.title);
    if (!title) return c.json({ error: "Title is required" }, 400);
    const list = updateList(db, c.req.param("id"), title);
    if (!list) return c.json({ error: "List not found" }, 404);
    return c.json(list);
  });

  app.delete("/api/lists/:id", (c) => {
    if (!deleteList(db, c.req.param("id"))) return c.json({ error: "List not found" }, 404);
    return c.body(null, 204);
  });

  app.post("/api/lists/:id/cards", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) return c.json({ error: "Invalid body" }, 400);
    const title = parseTitle(body.title);
    if (!title) return c.json({ error: "Title is required" }, 400);
    const card = createCard(db, c.req.param("id"), title);
    if (!card) return c.json({ error: "List not found" }, 404);
    return c.json(card, 201);
  });

  app.patch("/api/cards/:id", async (c) => {
    const body = await readJson(c.req.raw);
    if (!isRecord(body)) return c.json({ error: "Invalid body" }, 400);
    const patch: { title?: string; description?: string; labels?: string[] } = {};
    if ("title" in body) {
      const title = parseTitle(body.title);
      if (!title) return c.json({ error: "Title is required" }, 400);
      patch.title = title;
    }
    if ("description" in body) {
      const description = parseDescription(body.description);
      if (description === null) return c.json({ error: "Description is too long" }, 400);
      patch.description = description;
    }
    if ("labels" in body) {
      const labels = parseLabels(body.labels);
      if (!labels) return c.json({ error: "Unknown label" }, 400);
      patch.labels = labels;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "Nothing to update" }, 400);
    const card = updateCard(db, c.req.param("id"), patch);
    if (!card) return c.json({ error: "Card not found" }, 404);
    return c.json(card);
  });

  app.delete("/api/cards/:id", (c) => {
    if (!deleteCard(db, c.req.param("id"))) return c.json({ error: "Card not found" }, 404);
    return c.body(null, 204);
  });

  return app;
}
