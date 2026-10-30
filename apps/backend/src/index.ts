import { createApp } from "./app";
import { createDatabase, seedIfEmpty } from "./db";

const database = createDatabase();
seedIfEmpty(database);
const app = createApp(database);

console.log("Slate API listening on http://localhost:3001");

export default {
  port: 3001,
  fetch: app.fetch,
};
