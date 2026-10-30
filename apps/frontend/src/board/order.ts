export type Lane<TCard extends { id: string }> = {
  id: string;
  cards: TCard[];
};

export type CardPlacement = "before" | "after" | "end";

export function findLaneId(lanes: readonly Lane<{ id: string }>[], id: string): string | undefined {
  if (lanes.some((lane) => lane.id === id)) return id;
  return lanes.find((lane) => lane.cards.some((card) => card.id === id))?.id;
}

export function orderSignature(lanes: readonly Lane<{ id: string }>[]): string {
  return lanes.map((lane) => `${lane.id}:${lane.cards.map((card) => card.id).join(",")}`).join("|");
}

export function reorderLanes<TLane extends Lane<{ id: string }>>(
  lanes: TLane[],
  activeId: string,
  overId: string,
): TLane[] {
  const from = lanes.findIndex((lane) => lane.id === activeId);
  const toId = findLaneId(lanes, overId);
  const to = lanes.findIndex((lane) => lane.id === toId);
  if (from < 0 || to < 0 || from === to) return lanes;
  const next = lanes.slice();
  const [lane] = next.splice(from, 1);
  if (!lane) return lanes;
  next.splice(to, 0, lane);
  return next;
}

export function reorderCards<TCard extends { id: string }, TLane extends Lane<TCard>>(
  lanes: TLane[],
  laneId: string,
  activeId: string,
  overId: string,
): TLane[] {
  if (activeId === overId || overId === laneId) return lanes;
  let changed = false;
  const next = lanes.map((lane) => {
    if (lane.id !== laneId) return lane;
    const from = lane.cards.findIndex((card) => card.id === activeId);
    const to = lane.cards.findIndex((card) => card.id === overId);
    if (from < 0 || to < 0 || from === to) return lane;
    const cards = lane.cards.slice();
    const [card] = cards.splice(from, 1);
    if (!card) return lane;
    cards.splice(to, 0, card);
    changed = true;
    return { ...lane, cards };
  });
  return changed ? next : lanes;
}

export function moveCard<TCard extends { id: string }, TLane extends Lane<TCard>>(
  lanes: TLane[],
  activeId: string,
  overId: string,
  placement: CardPlacement,
): TLane[] {
  const fromId = findLaneId(lanes, activeId);
  const toId = findLaneId(lanes, overId);
  if (!fromId || !toId || fromId === toId) return lanes;

  const fromLane = lanes.find((lane) => lane.id === fromId);
  const toLane = lanes.find((lane) => lane.id === toId);
  if (!fromLane || !toLane) return lanes;
  const card = fromLane.cards.find((item) => item.id === activeId);
  if (!card) return lanes;

  let index = toLane.cards.length;
  if (placement !== "end") {
    const overIndex = toLane.cards.findIndex((item) => item.id === overId);
    if (overIndex >= 0) index = placement === "after" ? overIndex + 1 : overIndex;
  }

  return lanes.map((lane) => {
    if (lane.id === fromId) {
      return { ...lane, cards: lane.cards.filter((item) => item.id !== activeId) };
    }
    if (lane.id === toId) {
      const cards = lane.cards.slice();
      cards.splice(index, 0, card);
      return { ...lane, cards };
    }
    return lane;
  });
}
