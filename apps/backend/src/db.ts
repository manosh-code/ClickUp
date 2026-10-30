import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import type { BoardDetail, BoardList, BoardSummary, Card, OrderResult } from "./types";

const ALLOWED_LABELS = new Set(["bug", "feature", "design", "urgent"]);

type BoardRow = {
  id: string;
  title: string;
  color: string;
  created_at: number;
  list_count: number;
  card_count: number;
};

type ListRow = {
  id: string;
  title: string;
  position: number;
};

type CardRow = {
  id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  labels: string;
};

const BOARD_SELECT = `
  SELECT
    b.id,
    b.title,
    b.color,
    b.created_at,
    (SELECT COUNT(*) FROM lists l WHERE l.board_id = b.id) AS list_count,
    (
      SELECT COUNT(*)
      FROM cards c
      JOIN lists l ON l.id = c.list_id
      WHERE l.board_id = b.id
    ) AS card_count
  FROM boards b
`;

export function createDatabase(filename = "data/board.db"): Database {
  if (filename !== ":memory:") {
    mkdirSync(dirname(filename), { recursive: true });
    const db = new Database(filename, { create: true });
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    migrate(db);
    return db;
  }

  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      labels TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS lists_board_idx ON lists(board_id, position);
    CREATE INDEX IF NOT EXISTS cards_list_idx ON cards(list_id, position);
  `);
}

function mapBoard(row: BoardRow): BoardSummary {
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    createdAt: row.created_at,
    listCount: row.list_count,
    cardCount: row.card_count,
  };
}

function decodeLabels(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && ALLOWED_LABELS.has(item));
  } catch {
    return [];
  }
}

function mapCard(row: CardRow): Card {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    description: row.description,
    position: row.position,
    labels: decodeLabels(row.labels),
  };
}

export function listBoards(db: Database): BoardSummary[] {
  const rows = db.query<BoardRow, []>(`${BOARD_SELECT} ORDER BY b.created_at DESC`).all();
  return rows.map(mapBoard);
}

export function getBoardSummary(db: Database, id: string): BoardSummary | null {
  const row = db.query<BoardRow, [string]>(`${BOARD_SELECT} WHERE b.id = ?`).get(id);
  return row ? mapBoard(row) : null;
}

export function getBoardDetail(db: Database, id: string): BoardDetail | null {
  const summary = getBoardSummary(db, id);
  if (!summary) return null;

  const lists = db
    .query<ListRow, [string]>(
      "SELECT id, title, position FROM lists WHERE board_id = ? ORDER BY position, id",
    )
    .all(id);
  const cards = db
    .query<CardRow, [string]>(
      `SELECT c.id, c.list_id, c.title, c.description, c.position, c.labels
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       WHERE l.board_id = ?
       ORDER BY c.position, c.id`,
    )
    .all(id);

  const cardsByList = new Map<string, Card[]>();
  for (const row of cards) {
    const card = mapCard(row);
    const bucket = cardsByList.get(row.list_id);
    if (bucket) bucket.push(card);
    else cardsByList.set(row.list_id, [card]);
  }

  return {
    id: summary.id,
    title: summary.title,
    color: summary.color,
    createdAt: summary.createdAt,
    lists: lists.map((list) => ({
      id: list.id,
      title: list.title,
      position: list.position,
      cards: cardsByList.get(list.id) ?? [],
    })),
  };
}

export function createBoard(db: Database, title: string, color: string): BoardSummary {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  db.query("INSERT INTO boards (id, title, color, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    title,
    color,
    createdAt,
  );
  return { id, title, color, createdAt, listCount: 0, cardCount: 0 };
}

export function updateBoard(
  db: Database,
  id: string,
  patch: { title?: string; color?: string },
): BoardSummary | null {
  const current = getBoardSummary(db, id);
  if (!current) return null;
  const title = patch.title ?? current.title;
  const color = patch.color ?? current.color;
  db.query("UPDATE boards SET title = ?, color = ? WHERE id = ?").run(title, color, id);
  return getBoardSummary(db, id);
}

export function deleteBoard(db: Database, id: string): boolean {
  const result = db.query("DELETE FROM boards WHERE id = ?").run(id);
  return result.changes > 0;
}

function nextPosition(db: Database, sql: string, id: string): number {
  const row = db.query<{ max_pos: number | null }, [string]>(sql).get(id);
  return (row?.max_pos ?? -1) + 1;
}

export function createList(db: Database, boardId: string, title: string): BoardList | null {
  const board = db.query<{ id: string }, [string]>("SELECT id FROM boards WHERE id = ?").get(boardId);
  if (!board) return null;
  const id = crypto.randomUUID();
  const position = nextPosition(db, "SELECT MAX(position) AS max_pos FROM lists WHERE board_id = ?", boardId);
  db.query("INSERT INTO lists (id, board_id, title, position) VALUES (?, ?, ?, ?)").run(
    id,
    boardId,
    title,
    position,
  );
  return { id, title, position, cards: [] };
}

export function updateList(db: Database, id: string, title: string): BoardList | null {
  const existing = db
    .query<ListRow, [string]>("SELECT id, title, position FROM lists WHERE id = ?")
    .get(id);
  if (!existing) return null;
  db.query("UPDATE lists SET title = ? WHERE id = ?").run(title, id);
  const cards = db
    .query<CardRow, [string]>(
      "SELECT id, list_id, title, description, position, labels FROM cards WHERE list_id = ? ORDER BY position, id",
    )
    .all(id);
  return {
    id,
    title,
    position: existing.position,
    cards: cards.map(mapCard),
  };
}

export function deleteList(db: Database, id: string): boolean {
  const result = db.query("DELETE FROM lists WHERE id = ?").run(id);
  return result.changes > 0;
}

export function createCard(
  db: Database,
  listId: string,
  title: string,
  description = "",
  labels: string[] = [],
): Card | null {
  const list = db.query<{ id: string }, [string]>("SELECT id FROM lists WHERE id = ?").get(listId);
  if (!list) return null;
  const id = crypto.randomUUID();
  const position = nextPosition(db, "SELECT MAX(position) AS max_pos FROM cards WHERE list_id = ?", listId);
  db.query(
    "INSERT INTO cards (id, list_id, title, description, position, labels) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, listId, title, description, position, JSON.stringify(labels));
  return { id, listId, title, description, position, labels };
}

export function updateCard(
  db: Database,
  id: string,
  patch: { title?: string; description?: string; labels?: string[] },
): Card | null {
  const existing = db
    .query<CardRow, [string]>(
      "SELECT id, list_id, title, description, position, labels FROM cards WHERE id = ?",
    )
    .get(id);
  if (!existing) return null;
  const current = mapCard(existing);
  const next: Card = {
    ...current,
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    labels: patch.labels ?? current.labels,
  };
  db.query("UPDATE cards SET title = ?, description = ?, labels = ? WHERE id = ?").run(
    next.title,
    next.description,
    JSON.stringify(next.labels),
    id,
  );
  return next;
}

export function deleteCard(db: Database, id: string): boolean {
  const result = db.query("DELETE FROM cards WHERE id = ?").run(id);
  return result.changes > 0;
}

export function saveOrder(
  db: Database,
  boardId: string,
  listIds: string[],
  cardIdsByList: Record<string, string[]>,
): OrderResult {
  const board = db.query<{ id: string }, [string]>("SELECT id FROM boards WHERE id = ?").get(boardId);
  if (!board) return { status: "not_found" };

  const existingLists = db
    .query<{ id: string }, [string]>("SELECT id FROM lists WHERE board_id = ?")
    .all(boardId);
  const existingCards = db
    .query<{ id: string }, [string]>(
      `SELECT c.id AS id
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       WHERE l.board_id = ?`,
    )
    .all(boardId);

  const listSet = new Set(existingLists.map((list) => list.id));
  if (listIds.length !== listSet.size || new Set(listIds).size !== listIds.length) {
    return { status: "invalid" };
  }
  for (const listId of listIds) {
    if (!listSet.has(listId)) return { status: "invalid" };
  }

  const seen = new Set<string>();
  for (const listId of listIds) {
    const cardIds = cardIdsByList[listId];
    if (!cardIds) return { status: "invalid" };
    for (const cardId of cardIds) {
      if (typeof cardId !== "string" || seen.has(cardId)) return { status: "invalid" };
      seen.add(cardId);
    }
  }

  const cardSet = new Set(existingCards.map((card) => card.id));
  if (seen.size !== cardSet.size) return { status: "invalid" };
  for (const cardId of seen) {
    if (!cardSet.has(cardId)) return { status: "invalid" };
  }

  const apply = db.transaction(() => {
    const updateList = db.query("UPDATE lists SET position = ? WHERE id = ? AND board_id = ?");
    listIds.forEach((listId, index) => {
      updateList.run(index, listId, boardId);
    });
    const updateCard = db.query("UPDATE cards SET list_id = ?, position = ? WHERE id = ?");
    for (const listId of listIds) {
      const cardIds = cardIdsByList[listId] ?? [];
      cardIds.forEach((cardId, index) => {
        updateCard.run(listId, index, cardId);
      });
    }
  });
  apply();

  const detail = getBoardDetail(db, boardId);
  if (!detail) return { status: "not_found" };
  return { status: "ok", board: detail };
}

export function seedIfEmpty(db: Database): void {
  const row = db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM boards").get();
  if (!row || row.count > 0) return;

  const website = createBoard(db, "Website relaunch", "#1f3a5f");
  const backlog = createList(db, website.id, "Backlog");
  const doing = createList(db, website.id, "Doing");
  const review = createList(db, website.id, "Review");
  const done = createList(db, website.id, "Done");
  if (!backlog || !doing || !review || !done) return;

  createCard(
    db,
    backlog.id,
    "Rewrite the pricing page",
    "Lead with the team plan. Move the comparison table below the fold.",
    ["feature"],
  );
  createCard(
    db,
    backlog.id,
    "Collect launch screenshots",
    "Homepage, pricing, and the empty board state.",
    ["design"],
  );
  createCard(
    db,
    doing.id,
    "Fix checkout tax rounding",
    "Cents drift on EU VAT. Reproduce with a 19% rate and a fractional unit price.",
    ["bug", "urgent"],
  );
  createCard(db, review.id, "Homepage hero copy", "Shorter headline. One sentence under it.", ["design"]);
  createCard(db, done.id, "Ship the status page", "Linked from the footer.", []);

  const hiring = createBoard(db, "Hiring pipeline", "#5c3d6e");
  const inbox = createList(db, hiring.id, "Inbox");
  const screen = createList(db, hiring.id, "Screen");
  const onsite = createList(db, hiring.id, "Onsite");
  if (!inbox || !screen || !onsite) return;

  createCard(db, inbox.id, "Staff engineer — platform", "Referral from the infra team.", ["feature"]);
  createCard(db, screen.id, "Product designer", "Portfolio review scheduled Thursday.", ["design"]);
  createCard(db, onsite.id, "Support lead", "Panel plus a working session on the queue.", []);
}
