import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { createDatabase, listBoards, seedIfEmpty } from "./db";
import type { BoardDetail, BoardList, BoardSummary, Card } from "./types";

function app() {
  return createApp(createDatabase(":memory:"));
}

async function postJson(api: ReturnType<typeof createApp>, path: string, body: unknown) {
  return api.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("boards", () => {
  test("rejects an empty title", async () => {
    const response = await postJson(app(), "/api/boards", { title: "  ", color: "#1f3a5f" });
    expect(response.status).toBe(400);
  });

  test("creates a board, list, and card, then reorders", async () => {
    const api = app();
    const created = await postJson(api, "/api/boards", { title: "Demo", color: "#1F3A5F" });
    expect(created.status).toBe(201);
    const board = (await created.json()) as BoardSummary;
    expect(board.color).toBe("#1f3a5f");

    const listResponse = await postJson(api, `/api/boards/${board.id}/lists`, { title: "Todo" });
    const otherListResponse = await postJson(api, `/api/boards/${board.id}/lists`, { title: "Done" });
    const list = (await listResponse.json()) as BoardList;
    const other = (await otherListResponse.json()) as BoardList;

    const firstCard = (await (await postJson(api, `/api/lists/${list.id}/cards`, { title: "One" })).json()) as Card;
    const secondCard = (await (await postJson(api, `/api/lists/${list.id}/cards`, { title: "Two" })).json()) as Card;

    const ordered = await api.request(`/api/boards/${board.id}/order`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listIds: [other.id, list.id],
        cardIdsByList: {
          [other.id]: [secondCard.id],
          [list.id]: [firstCard.id],
        },
      }),
    });
    expect(ordered.status).toBe(200);
    const detail = (await ordered.json()) as BoardDetail;
    expect(detail.lists.map((item) => item.id)).toEqual([other.id, list.id]);
    expect(detail.lists[0]?.cards.map((card) => card.id)).toEqual([secondCard.id]);
    expect(detail.lists[1]?.cards.map((card) => card.id)).toEqual([firstCard.id]);
  });

  test("rejects an order that drops a card", async () => {
    const api = app();
    const board = (await (await postJson(api, "/api/boards", { title: "Demo", color: "#1f3a5f" })).json()) as BoardSummary;
    const list = (await (await postJson(api, `/api/boards/${board.id}/lists`, { title: "Todo" })).json()) as BoardList;
    await postJson(api, `/api/lists/${list.id}/cards`, { title: "Keep me" });

    const ordered = await api.request(`/api/boards/${board.id}/order`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listIds: [list.id], cardIdsByList: { [list.id]: [] } }),
    });
    expect(ordered.status).toBe(400);
  });

  test("deleting a board removes its lists", async () => {
    const api = app();
    const board = (await (await postJson(api, "/api/boards", { title: "Demo", color: "#1f3a5f" })).json()) as BoardSummary;
    const list = (await (await postJson(api, `/api/boards/${board.id}/lists`, { title: "Todo" })).json()) as BoardList;
    const removed = await api.request(`/api/boards/${board.id}`, { method: "DELETE" });
    expect(removed.status).toBe(204);
    const missing = await api.request(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Still here" }),
    });
    expect(missing.status).toBe(404);
  });

  test("seed runs once", () => {
    const db = createDatabase(":memory:");
    seedIfEmpty(db);
    seedIfEmpty(db);
    expect(listBoards(db)).toHaveLength(2);
  });
});
