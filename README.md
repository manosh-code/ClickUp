# Slate

A Trello-style board app: boards, lists, and cards, with drag-and-drop ordering stored in SQLite.

## Layout

```
apps/backend     Bun + Hono API
apps/frontend    React + Vite board UI
packages/ui      Shared buttons, fields, and modal
packages/eslint-config
packages/typescript-config
```

## Scripts

```sh
bun install
bun run dev         # API on :3001, UI on :5173
bun run build
bun run lint
bun run typecheck
bun run test
```

Open http://127.0.0.1:5173. The dev server proxies `/api` to the backend. The first launch seeds two boards.

## API

- `GET/POST /api/boards`
- `GET/PATCH/DELETE /api/boards/:id`
- `POST /api/boards/:id/lists`
- `PUT /api/boards/:id/order`
- `PATCH/DELETE /api/lists/:id`
- `POST /api/lists/:id/cards`
- `PATCH/DELETE /api/cards/:id`
