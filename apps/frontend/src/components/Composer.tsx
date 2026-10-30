import { useState, type KeyboardEvent } from "react";
import { Button } from "@trello/ui";

type ComposerProps = {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
};

export function Composer({ label, placeholder, submitLabel, onSubmit }: ComposerProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setValue("");
  }

  async function submit() {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onSubmit(title);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
    if (event.key === "Escape") close();
  }

  if (!open) {
    return (
      <button className="composer-open" type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <textarea
        autoFocus
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer-actions">
        <Button type="submit" disabled={busy || value.trim().length === 0}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
