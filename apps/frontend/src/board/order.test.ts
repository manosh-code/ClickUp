import { describe, expect, test } from "bun:test";
import { moveCard, orderSignature, reorderCards, reorderLanes } from "./order";

const lanes = [
  { id: "a", title: "A", cards: [{ id: "a1" }, { id: "a2" }] },
  { id: "b", title: "B", cards: [{ id: "b1" }] },
  { id: "c", title: "C", cards: [] as { id: string }[] },
];

describe("order", () => {
  test("reorders lanes when dropped on a card", () => {
    const next = reorderLanes(lanes, "a", "b1");
    expect(next.map((lane) => lane.id)).toEqual(["b", "a", "c"]);
    expect(next[1]?.title).toBe("A");
  });

  test("reorders cards inside a lane", () => {
    const next = reorderCards(lanes, "a", "a2", "a1");
    expect(next[0]?.cards.map((card) => card.id)).toEqual(["a2", "a1"]);
    expect(next[1]).toBe(lanes[1]);
  });

  test("moves a card onto an empty lane", () => {
    const next = moveCard(lanes, "a1", "c", "end");
    expect(next[0]?.cards.map((card) => card.id)).toEqual(["a2"]);
    expect(next[2]?.cards.map((card) => card.id)).toEqual(["a1"]);
  });

  test("inserts a card before the card under the pointer", () => {
    const next = moveCard(lanes, "b1", "a2", "before");
    expect(next[0]?.cards.map((card) => card.id)).toEqual(["a1", "b1", "a2"]);
    expect(next[1]?.cards).toEqual([]);
  });

  test("signature changes only when order changes", () => {
    expect(orderSignature(lanes)).toBe(orderSignature(reorderCards(lanes, "a", "a1", "a1")));
    expect(orderSignature(moveCard(lanes, "a1", "c", "end"))).not.toBe(orderSignature(lanes));
  });
});
