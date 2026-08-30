import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// TEMPLATE: placeholder table only. The source of truth for physical columns is
// docs/3-development/07-database-schema.md — generate the real tables from that
// spec (DEV-01 §1 "ORM / スキーマ管理") instead of hand-editing this file long-term.
export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["admin", "editor"] }).notNull(),
});
