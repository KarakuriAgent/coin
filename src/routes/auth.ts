import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db, persistDb } from "../db/index.js";
import { accounts } from "../db/schema.js";
import { setSession, clearSession } from "../middleware/session.js";

const auth = new Hono();

auth.get("/discord", (c) => {
  if (!config.discord.clientId) {
    return c.json(
      { error: { code: "NOT_CONFIGURED", message: "Discord OAuth2 is not configured" } },
      404
    );
  }

  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: "code",
    scope: "identify",
  });

  return c.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

auth.get("/discord/callback", async (c) => {
  if (!config.discord.clientId) {
    return c.json(
      { error: { code: "NOT_CONFIGURED", message: "Discord OAuth2 is not configured" } },
      404
    );
  }

  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing code parameter", 400);
  }

  // Exchange code for token
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.discord.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return c.text("Failed to exchange code for token", 400);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Get user info
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return c.text("Failed to get user info", 400);
  }

  const user = (await userRes.json()) as { id: string; username: string };

  // Create account if not exists
  const existing = db
    .select()
    .from(accounts)
    .where(eq(accounts.discordId, user.id))
    .get();

  if (!existing) {
    db.insert(accounts)
      .values({
        id: crypto.randomUUID(),
        discordId: user.id,
        username: user.username,
      })
      .run();
    persistDb();
  } else if (user.username !== existing.username) {
    db.update(accounts)
      .set({ username: user.username })
      .where(eq(accounts.id, existing.id))
      .run();
    persistDb();
  }

  setSession(c, { discord_id: user.id, username: user.username });
  return c.redirect("/dashboard");
});

auth.get("/logout", (c) => {
  clearSession(c);
  return c.redirect("/");
});

export default auth;
