import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username"),
  balance: integer("balance").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  type: text("type", { enum: ["credit", "debit"] }).notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
