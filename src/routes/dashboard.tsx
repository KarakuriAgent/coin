import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { accounts, transactions } from "../db/schema.js";
import { getSession } from "../middleware/session.js";
import { DashboardPage } from "../views/dashboard.js";

const dashboard = new Hono();

dashboard.get("/", (c) => {
  const session = getSession(c);
  if (!session) {
    return c.redirect("/auth/discord");
  }

  const account = db
    .select()
    .from(accounts)
    .where(eq(accounts.discordId, session.discord_id))
    .get();

  if (!account) {
    return c.html(
      <html>
        <body>
          <p>Account not found. Please contact an administrator.</p>
          <a href="/auth/logout">Logout</a>
        </body>
      </html>
    );
  }

  const txList = db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, account.id))
    .orderBy(desc(transactions.createdAt))
    .limit(50)
    .all();

  return c.html(
    <DashboardPage
      username={session.username}
      balance={account.balance}
      transactions={txList}
    />
  );
});

export default dashboard;
