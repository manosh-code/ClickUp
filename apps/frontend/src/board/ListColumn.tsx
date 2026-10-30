import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@trello/ui";
import { Composer } from "../components/Composer";
import { CardItem } from "./CardItem";
import type { BoardList } from "../types";

type ListColumnProps = {
  list: BoardList;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onOpenCard: (id: string) => void;
};

export function ListColumn({ list, onRename, onDelete, onAddCard, onOpenCard }: ListColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list" },
  });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [confirming, setConfirming] = useState(false);

  async function commitTitle() {
    const next = title.trim();
    if (!next || next === list.title) {
      setTitle(list.title);
      setEditing(false);
      return;
    }
    await onRename(list.id, next);
    setEditing(false);
  }

  return (
    <section
      ref={setNodeRef}
      className={isDragging ? "lane is-dragging" : "lane"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="lane"
    >
      <header className="lane-header">
        {editing ? (
          <input
            className="lane-title-input"
            value={title}
            autoFocus
            aria-label="List title"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void commitTitle()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitTitle();
              }
              if (event.key === "Escape") {
                setTitle(list.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button className="lane-title" type="button" {...attributes} {...listeners} onClick={() => setEditing(true)}>
            {list.title}
          </button>
        )}
        <button
          className="icon-btn"
          type="button"
          aria-label={`Delete ${list.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setConfirming((value) => !value)}
        >
          ×
        </button>
      </header>
      {confirming ? (
        <div className="confirm-row">
          <span>Delete this list?</span>
          <Button
            variant="danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void onDelete(list.id)}
          >
            Delete
          </Button>
        </div>
      ) : null}
      <SortableContext items={list.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="lane-cards">
          {list.cards.map((card) => (
            <CardItem key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </div>
      </SortableContext>
      <Composer
        label="Add a card"
        placeholder="Card title"
        submitLabel="Add card"
        onSubmit={(value) => onAddCard(list.id, value)}
      />
    </section>
  );
}
