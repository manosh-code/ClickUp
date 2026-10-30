import { useEffect, useState } from "react";
import { Button, Modal, TextField } from "@trello/ui";
import { api } from "../api";
import { BOARD_COLORS } from "../colors";
import { Mark } from "../components/Mark";
import type { BoardSummary } from "../types";

type HomeProps = {
  onOpen: (id: string) => void;
};

export function Home({ onOpen }: HomeProps) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(BOARD_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .listBoards()
      .then((next) => {
        if (!active) return;
        setBoards(next);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Could not load boards");
      });
    return () => {
      active = false;
    };
  }, []);

  async function createBoard() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const board = await api.createBoard(nextTitle, color);
      setBoards((current) => [board, ...current]);
      setCreating(false);
      setTitle("");
      onOpen(board.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create board");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <header className="topbar">
        <div className="brand">
          <Mark />
          <span>Slate</span>
        </div>
      </header>
      <main className="home-main">
        <div className="home-intro">
          <h1>Boards</h1>
          <p>Lists, cards, and the work moving between them.</p>
        </div>
        {status === "loading" ? <p className="status-line">Loading boards…</p> : null}
        {status === "error" ? <p className="form-error">{error}</p> : null}
        {status === "ready" ? (
          <div className="board-grid">
            {boards.map((board) => (
              <button
                key={board.id}
                className="board-tile"
                type="button"
                style={{ background: board.color }}
                onClick={() => onOpen(board.id)}
              >
                <span>{board.title}</span>
                <small>
                  {board.listCount} lists · {board.cardCount} cards
                </small>
              </button>
            ))}
            <button className="board-tile create" type="button" onClick={() => setCreating(true)}>
              Create board
            </button>
          </div>
        ) : null}
      </main>
      {creating ? (
        <Modal title="Create board" onClose={() => setCreating(false)}>
          <form
            className="create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createBoard();
            }}
          >
            <TextField label="Board title" value={title} onChange={setTitle} autoFocus placeholder="Quarterly plan" />
            <fieldset className="label-picker">
              <legend>Color</legend>
              <div className="swatches swatches-dark">
                {BOARD_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={swatch === color ? "swatch is-selected" : "swatch"}
                    style={{ background: swatch }}
                    aria-label={swatch}
                    aria-pressed={swatch === color}
                    onClick={() => setColor(swatch)}
                  />
                ))}
              </div>
            </fieldset>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="dialog-actions-end">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Create
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
