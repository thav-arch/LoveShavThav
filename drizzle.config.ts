import { defineConfig } from "drizzle-kit";

// `npm run db:generate` turns schema changes into SQL migrations in ./drizzle
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/cms/db/schema.ts",
  out: "./drizzle",
});
