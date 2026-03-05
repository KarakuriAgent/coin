import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { apiKeyAuth } from "./middleware/apiKey.js";
import api from "./routes/api.js";
import auth from "./routes/auth.js";
import dashboard from "./routes/dashboard.js";

const app = new Hono();

// Run migrations on startup
runMigrations();

// API key auth for /api routes
app.use("/api/*", apiKeyAuth);

// Mount routes
app.route("/api", api);
app.route("/auth", auth);
app.route("/dashboard", dashboard);

// Root redirect
app.get("/", (c) => c.redirect("/dashboard"));

console.log(`Coin server starting on http://${config.host}:${config.port}`);

serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port,
});
