import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardFace } from "./CardFace";
import type { Card } from "../types";

type CardItemProps = {
  card: Card;
  onOpen: (id: string) => void;
};

export function CardItem({ card, onOpen }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "card-shell is-dragging" : "card-shell"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      data-testid="card"
    >
      <CardFace card={card} />
    </div>
  );
}
