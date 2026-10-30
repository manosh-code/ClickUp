import { labelById } from "../labels";
import type { Card } from "../types";

export function CardFace({ card }: { card: Card }) {
  return (
    <article className="card">
      {card.labels.length > 0 ? (
        <div className="card-labels">
          {card.labels.map((id) => {
            const label = labelById(id);
            if (!label) return null;
            return (
              <span key={id} className="label-chip" style={{ background: label.color }}>
                {label.name}
              </span>
            );
          })}
        </div>
      ) : null}
      <h3>{card.title}</h3>
      {card.description ? <p className="card-excerpt">{card.description}</p> : null}
    </article>
  );
}
