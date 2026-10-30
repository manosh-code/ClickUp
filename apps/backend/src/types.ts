export type BoardSummary = {
  id: string;
  title: string;
  color: string;
  createdAt: number;
  listCount: number;
  cardCount: number;
};

export type Card = {
  id: string;
  listId: string;
  title: string;
  description: string;
  position: number;
  labels: string[];
};

export type BoardList = {
  id: string;
  title: string;
  position: number;
  cards: Card[];
};

export type BoardDetail = {
  id: string;
  title: string;
  color: string;
  createdAt: number;
  lists: BoardList[];
};

export type OrderResult =
  | { status: "ok"; board: BoardDetail }
  | { status: "not_found" }
  | { status: "invalid" };
