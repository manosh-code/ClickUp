import type { BoardDetail, BoardList, BoardSummary, Card, CardPatch } from "./types";

type OrderBody = {
  listIds: string[];
  cardIdsByList: Record<string, string[]>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listBoards: () => request<BoardSummary[]>("/api/boards"),
  createBoard: (title: string, color: string) =>
    request<BoardSummary>("/api/boards", {
      method: "POST",
      body: JSON.stringify({ title, color }),
    }),
  getBoard: (id: string) => request<BoardDetail>(`/api/boards/${id}`),
  updateBoard: (id: string, patch: { title?: string; color?: string }) =>
    request<BoardSummary>(`/api/boards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteBoard: (id: string) => request<void>(`/api/boards/${id}`, { method: "DELETE" }),
  createList: (boardId: string, title: string) =>
    request<BoardList>(`/api/boards/${boardId}/lists`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  updateList: (id: string, title: string) =>
    request<BoardList>(`/api/lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  deleteList: (id: string) => request<void>(`/api/lists/${id}`, { method: "DELETE" }),
  createCard: (listId: string, title: string) =>
    request<Card>(`/api/lists/${listId}/cards`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  updateCard: (id: string, patch: CardPatch) =>
    request<Card>(`/api/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteCard: (id: string) => request<void>(`/api/cards/${id}`, { method: "DELETE" }),
  saveOrder: (boardId: string, body: OrderBody) =>
    request<BoardDetail>(`/api/boards/${boardId}/order`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
