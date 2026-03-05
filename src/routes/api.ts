import { Hono } from "hono";
import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { db, sqlite, persistDb } from "../db/index.js";
import { accounts, transactions } from "../db/schema.js";

const api = new Hono();

function withTransaction<T>(fn: () => T): T {
  sqlite.run("BEGIN");
  try {
    const result = fn();
    sqlite.run("COMMIT");
    persistDb();
    return result;
  } catch (e) {
    sqlite.run("ROLLBACK");
    throw e;
  }
}

// Health check
api.get("/health", (c) => {
  return c.json({ status: "ok", version: "1.0.0" });
});

// Create account
const createAccountSchema = z.object({
  discord_id: z.string().min(1),
  username: z.string().optional(),
});

api.post("/accounts", async (c) => {
  const body = await c.req.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      400
    );
  }

  const { discord_id, username } = parsed.data;

  const existing = db
    .select()
    .from(accounts)
    .where(eq(accounts.discordId, discord_id))
    .get();

  if (existing) {
    if (username && username !== existing.username) {
      db.update(accounts)
        .set({ username, updatedAt: sql`datetime('now')` })
        .where(eq(accounts.id, existing.id))
        .run();
      persistDb();
      existing.username = username;
    }
    return c.json(existing);
  }

  const id = crypto.randomUUID();
  const account = db
    .insert(accounts)
    .values({ id, discordId: discord_id, username: username || null })
    .returning()
    .get();

  persistDb();
  return c.json(account, 201);
});

// List accounts
api.get("/accounts", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .get()!.count;

  const list = db.select().from(accounts).limit(limit).offset(offset).all();

  return c.json({ accounts: list, total });
});

// Get account by discord_id
api.get("/accounts/:discord_id", async (c) => {
  const discord_id = c.req.param("discord_id");
  const account = db
    .select()
    .from(accounts)
    .where(eq(accounts.discordId, discord_id))
    .get();

  if (!account) {
    return c.json(
      { error: { code: "ACCOUNT_NOT_FOUND", message: "Account not found" } },
      404
    );
  }

  return c.json(account);
});

// Credit
const amountSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().optional(),
});

api.post("/accounts/:discord_id/credit", async (c) => {
  const discord_id = c.req.param("discord_id");
  const body = await c.req.json();
  const parsed = amountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_AMOUNT", message: parsed.error.message } },
      400
    );
  }

  const { amount, reason } = parsed.data;

  const result = withTransaction(() => {
    const account = db
      .select()
      .from(accounts)
      .where(eq(accounts.discordId, discord_id))
      .get();

    if (!account) return null;

    const newBalance = account.balance + amount;
    db.update(accounts)
      .set({ balance: newBalance, updatedAt: sql`datetime('now')` })
      .where(eq(accounts.id, account.id))
      .run();

    const txId = crypto.randomUUID();
    const tx = db
      .insert(transactions)
      .values({
        id: txId,
        accountId: account.id,
        type: "credit",
        amount,
        balanceAfter: newBalance,
        reason: reason || null,
      })
      .returning()
      .get();

    return { balance: newBalance, transaction: tx };
  });

  if (!result) {
    return c.json(
      { error: { code: "ACCOUNT_NOT_FOUND", message: "Account not found" } },
      404
    );
  }

  return c.json(result);
});

// Debit
api.post("/accounts/:discord_id/debit", async (c) => {
  const discord_id = c.req.param("discord_id");
  const body = await c.req.json();
  const parsed = amountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_AMOUNT", message: parsed.error.message } },
      400
    );
  }

  const { amount, reason } = parsed.data;

  const result = withTransaction(() => {
    const account = db
      .select()
      .from(accounts)
      .where(eq(accounts.discordId, discord_id))
      .get();

    if (!account) return { error: "not_found" as const };

    if (account.balance < amount) {
      return {
        error: "insufficient" as const,
        balance: account.balance,
        required: amount,
      };
    }

    const newBalance = account.balance - amount;
    db.update(accounts)
      .set({ balance: newBalance, updatedAt: sql`datetime('now')` })
      .where(eq(accounts.id, account.id))
      .run();

    const txId = crypto.randomUUID();
    const tx = db
      .insert(transactions)
      .values({
        id: txId,
        accountId: account.id,
        type: "debit",
        amount,
        balanceAfter: newBalance,
        reason: reason || null,
      })
      .returning()
      .get();

    return { balance: newBalance, transaction: tx };
  });

  if ("error" in result) {
    if (result.error === "not_found") {
      return c.json(
        { error: { code: "ACCOUNT_NOT_FOUND", message: "Account not found" } },
        404
      );
    }
    return c.json(
      {
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance (current: ${result.balance}, required: ${result.required})`,
        },
      },
      400
    );
  }

  return c.json(result);
});

// Transfer
const transferSchema = z.object({
  to_discord_id: z.string().min(1),
  amount: z.number().int().positive(),
  reason: z.string().optional(),
});

api.post("/accounts/:discord_id/transfer", async (c) => {
  const from_discord_id = c.req.param("discord_id");
  const body = await c.req.json();
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      400
    );
  }

  const { to_discord_id, amount, reason } = parsed.data;

  if (from_discord_id === to_discord_id) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Cannot transfer to self" } },
      400
    );
  }

  const result = withTransaction(() => {
    const fromAccount = db
      .select()
      .from(accounts)
      .where(eq(accounts.discordId, from_discord_id))
      .get();

    if (!fromAccount) return { error: "from_not_found" as const };

    const toAccount = db
      .select()
      .from(accounts)
      .where(eq(accounts.discordId, to_discord_id))
      .get();

    if (!toAccount) return { error: "to_not_found" as const };

    if (fromAccount.balance < amount) {
      return {
        error: "insufficient" as const,
        balance: fromAccount.balance,
        required: amount,
      };
    }

    const fromNewBalance = fromAccount.balance - amount;
    const toNewBalance = toAccount.balance + amount;
    const transferReason = reason || `Transfer to ${to_discord_id}`;

    db.update(accounts)
      .set({ balance: fromNewBalance, updatedAt: sql`datetime('now')` })
      .where(eq(accounts.id, fromAccount.id))
      .run();

    db.update(accounts)
      .set({ balance: toNewBalance, updatedAt: sql`datetime('now')` })
      .where(eq(accounts.id, toAccount.id))
      .run();

    const debitTx = db
      .insert(transactions)
      .values({
        id: crypto.randomUUID(),
        accountId: fromAccount.id,
        type: "debit",
        amount,
        balanceAfter: fromNewBalance,
        reason: transferReason,
      })
      .returning()
      .get();

    db.insert(transactions)
      .values({
        id: crypto.randomUUID(),
        accountId: toAccount.id,
        type: "credit",
        amount,
        balanceAfter: toNewBalance,
        reason: reason || `Transfer from ${from_discord_id}`,
      })
      .run();

    return {
      from_balance: fromNewBalance,
      to_balance: toNewBalance,
      transaction: debitTx,
    };
  });

  if ("error" in result) {
    if (result.error === "from_not_found") {
      return c.json(
        { error: { code: "ACCOUNT_NOT_FOUND", message: "Source account not found" } },
        404
      );
    }
    if (result.error === "to_not_found") {
      return c.json(
        { error: { code: "ACCOUNT_NOT_FOUND", message: "Destination account not found" } },
        404
      );
    }
    return c.json(
      {
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance (current: ${result.balance}, required: ${result.required})`,
        },
      },
      400
    );
  }

  return c.json(result);
});

// Transaction history
api.get("/accounts/:discord_id/transactions", async (c) => {
  const discord_id = c.req.param("discord_id");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const account = db
    .select()
    .from(accounts)
    .where(eq(accounts.discordId, discord_id))
    .get();

  if (!account) {
    return c.json(
      { error: { code: "ACCOUNT_NOT_FOUND", message: "Account not found" } },
      404
    );
  }

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.accountId, account.id))
    .get()!.count;

  const list = db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, account.id))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({ transactions: list, total });
});

export default api;
