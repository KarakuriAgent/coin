import "dotenv/config";

export const config = {
  host: process.env.HOST || "localhost",
  port: Number(process.env.PORT) || 3000,
  apiKey: process.env.API_KEY || "",
  databasePath: process.env.DATABASE_PATH || "./data/coin.db",
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ||
      "http://localhost:3000/auth/discord/callback",
  },
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",
};
