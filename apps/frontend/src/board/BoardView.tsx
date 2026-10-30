import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Button } from "@trello/ui";
import { api } from "../api";
import { BOARD_COLORS, isLightColor } from "../colors";
import { Composer } from "../components/Composer";
import { Mark } from "../components/Mark";
import type { BoardDetail, BoardList, CardPatch } from "../types";
import { CardDialog } from "./CardDialog";
import { CardFace } from "./CardFace";
import { ListColumn } from "./ListColumn";
import { findLaneId, moveCard, orderSignature, reorderCards, reorderLanes, type CardPlacement } from "./order";

type DragKind = "card" | "list";

type BoardViewProps = {
  boardId: string;
  onHome: () => void;
};

function readKind(data: unknown): DragKind | undefined {
  if (typeof data !== "object" || data === null || !("type" in data)) return undefined;
  const type = data.type;
  if (type === "card" || type === "list") return type;
  return undefined;
}

function placementFor(event: DragOverEvent, overId: string, laneId: string): CardPlacement {
  if (overId === laneId) return "end";
  const translated = event.active.rect.current.translated;
  const overRect = event.over?.rect;
  if (!translated || !overRect) return "before";
  const activeMiddle = translated.top + translated.height / 2;
  const overMiddle = overRect.top + overRect.height / 2;
  return activeMiddle > overMiddle ? "after" : "before";
}

export function BoardView({ boardId, onHome }: BoardViewProps) {
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [lists, setLists] = useState<BoardList[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<DragKind | undefined>();
  const listsRef = useRef<BoardList[]>([]);
  const snapshot = useRef<BoardList[] | null>(null);

  function commit(next: BoardList[]) {
    listsRef.current = next;
    setLists(next);
  }

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    setBoard(null);
    commit([]);

    api
      .getBoard(boardId)
      .then((detail) => {
        if (!active) return;
        setBoard(detail);
        setTitle(detail.title);
        commit(detail.lists);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Could not load board");
      });

    return () => {
      active = false;
    };
  }, [boardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(event: DragStartEvent) {
    snapshot.current = listsRef.current;
    setActiveId(String(event.active.id));
    setActiveKind(readKind(event.active.data.current));
    document.body.classList.add("is-dragging");
  }

  function clearDrag() {
    setActiveId(null);
    setActiveKind(undefined);
    document.body.classList.remove("is-dragging");
  }

  function onDragOver(event: DragOverEvent) {
    if (readKind(event.active.data.current) !== "card" || !event.over) return;
    const activeCardId = String(event.active.id);
    const overId = String(event.over.id);
    const from = findLaneId(listsRef.current, activeCardId);
    const to = findLaneId(listsRef.current, overId);
    if (!from || !to || from === to) return;
    const next = moveCard(listsRef.current, activeCardId, overId, placementFor(event, overId, to));
    if (next !== listsRef.current) commit(next);
  }

  function finishDrag(event: DragEndEvent) {
    const kind = readKind(event.active.data.current);
    const activeCardId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    let next = listsRef.current;

    switch (kind) {
      case "list":
        if (overId) next = reorderLanes(next, activeCardId, overId);
        break;
      case "card":
        if (overId) {
          const from = findLaneId(next, activeCardId);
          const to = findLaneId(next, overId);
          if (from && to && from === to) next = reorderCards(next, from, activeCardId, overId);
        }
        break;
      case undefined:
        break;
      default: {
        const exhaustive: never = kind;
        return exhaustive;
      }
    }

    const changed =
      snapshot.current !== null && orderSignature(next) !== orderSignature(snapshot.current);
    if (next !== listsRef.current) commit(next);
    clearDrag();
    snapshot.current = null;
    if (changed) void persist(next);
  }

  function onDragCancel() {
    if (snapshot.current) commit(snapshot.current);
    snapshot.current = null;
    clearDrag();
  }

  async function persist(next: BoardList[]) {
    try {
      const saved = await api.saveOrder(boardId, {
        listIds: next.map((list) => list.id),
        cardIdsByList: Object.fromEntries(next.map((list) => [list.id, list.cards.map((card) => card.id)])),
      });
      commit(saved.lists);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save order");
      const detail = await api.getBoard(boardId);
      setBoard(detail);
      commit(detail.lists);
    }
  }

  async function saveTitle() {
    if (!board) return;
    const next = title.trim();
    if (!next || next === board.title) {
      setTitle(board.title);
      return;
    }
    const updated = await api.updateBoard(board.id, { title: next });
    setBoard({ ...board, title: updated.title });
    setTitle(updated.title);
  }

  async function saveColor(color: string) {
    if (!board || color === board.color) return;
    const updated = await api.updateBoard(board.id, { color });
    setBoard({ ...board, color: updated.color });
  }

  async function removeBoard() {
    if (!board) return;
    await api.deleteBoard(board.id);
    onHome();
  }

  async function addList(value: string) {
    const list = await api.createList(boardId, value);
    commit([...listsRef.current, list]);
  }

  async function renameList(id: string, value: string) {
    const updated = await api.updateList(id, value);
    commit(listsRef.current.map((list) => (list.id === id ? { ...list, title: updated.title } : list)));
  }

  async function removeList(id: string) {
    await api.deleteList(id);
    commit(listsRef.current.filter((list) => list.id !== id));
    if (openCardId && listsRef.current.every((list) => list.cards.every((card) => card.id !== openCardId))) {
      setOpenCardId(null);
    }
  }

  async function addCard(listId: string, value: string) {
    const card = await api.createCard(listId, value);
    commit(
      listsRef.current.map((list) => (list.id === listId ? { ...list, cards: [...list.cards, card] } : list)),
    );
  }

  async function saveCard(id: string, patch: CardPatch) {
    const updated = await api.updateCard(id, patch);
    commit(
      listsRef.current.map((list) => ({
        ...list,
        cards: list.cards.map((card) => (card.id === id ? updated : card)),
      })),
    );
  }

  async function removeCard(id: string) {
    await api.deleteCard(id);
    commit(
      listsRef.current.map((list) => ({
        ...list,
        cards: list.cards.filter((card) => card.id !== id),
      })),
    );
    setOpenCardId(null);
  }

  const openCard = lists.flatMap((list) => list.cards).find((card) => card.id === openCardId);
  const activeCard =
    activeKind === "card" ? lists.flatMap((list) => list.cards).find((card) => card.id === activeId) : undefined;
  const activeList = activeKind === "list" ? lists.find((list) => list.id === activeId) : undefined;

  if (status === "loading") {
    return <p className="status-line">Loading board…</p>;
  }

  if (status === "error" || !board) {
    return (
      <div className="status-screen">
        <p>{error ?? "Board not found"}</p>
        <Button onClick={onHome}>All boards</Button>
      </div>
    );
  }

  const tone = isLightColor(board.color) ? "tone-light" : "tone-dark";

  return (
    <div className={`board-shell ${tone}`} style={{ "--board": board.color } as CSSProperties}>
      <header className="board-header">
        <button className="brand brand-button" type="button" onClick={onHome}>
          <Mark />
          <span>Slate</span>
        </button>
        <input
          className="board-title-input"
          aria-label="Board title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <div className="swatches" role="listbox" aria-label="Board color">
          {BOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={color === board.color ? "swatch is-selected" : "swatch"}
              style={{ background: color }}
              aria-label={color}
              aria-pressed={color === board.color}
              onClick={() => void saveColor(color)}
            />
          ))}
        </div>
        {confirmDelete ? (
          <div className="header-delete confirm-row">
            <span>Delete this board?</span>
            <Button variant="danger" onClick={() => void removeBoard()}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="header-delete" onClick={() => setConfirmDelete(true)}>
            Delete board
          </Button>
        )}
      </header>
      {error ? <p className="board-error">{error}</p> : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={finishDrag}
        onDragCancel={onDragCancel}
      >
        <div className="lanes">
          <SortableContext items={lists.map((list) => list.id)} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                onRename={renameList}
                onDelete={removeList}
                onAddCard={addCard}
                onOpenCard={setOpenCardId}
              />
            ))}
          </SortableContext>
          <div className="lane-slot">
            <Composer
              label="Add another list"
              placeholder="List title"
              submitLabel="Add list"
              onSubmit={addList}
            />
          </div>
        </div>
        <DragOverlay>
          {activeCard ? <CardFace card={activeCard} /> : null}
          {activeList ? <div className="lane lane-overlay">{activeList.title}</div> : null}
        </DragOverlay>
      </DndContext>
      {openCard ? (
        <CardDialog
          key={openCard.id}
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onSave={(patch) => saveCard(openCard.id, patch)}
          onDelete={() => removeCard(openCard.id)}
        />
      ) : null}
    </div>
  );
}
