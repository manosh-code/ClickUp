import { useState } from "react";
import { Button, Modal, TextField } from "@trello/ui";
import { LABELS } from "../labels";
import type { Card, CardPatch } from "../types";

type CardDialogProps = {
  card: Card;
  onClose: () => void;
  onSave: (patch: CardPatch) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function CardDialog({ card, onClose, onSave, onDelete }: CardDialogProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [labels, setLabels] = useState(card.labels);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ title: nextTitle, description: description.trim(), labels });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save card");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete card");
      setBusy(false);
    }
  }

  return (
    <Modal title={card.title} onClose={onClose}>
      <form
        className="card-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField label="Title" value={title} onChange={setTitle} autoFocus />
        <TextField label="Description" value={description} onChange={setDescription} multiline />
        <fieldset className="label-picker">
          <legend>Labels</legend>
          <div className="label-options">
            {LABELS.map((label) => {
              const pressed = labels.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  className={pressed ? "label-option is-on" : "label-option"}
                  aria-pressed={pressed}
                  onClick={() =>
                    setLabels((current) =>
                      current.includes(label.id)
                        ? current.filter((id) => id !== label.id)
                        : [...current, label.id],
                    )
                  }
                >
                  <span className="label-swatch" style={{ background: label.color }} />
                  {label.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="dialog-actions">
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>
            Delete
          </Button>
          <div className="dialog-actions-end">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
