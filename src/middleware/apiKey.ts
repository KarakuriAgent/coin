import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  if (!config.apiKey) {
    return next();
  }

  const auth = c.req.header("Authorization");
  if (!auth || auth !== `Bearer ${config.apiKey}`) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
      401
    );
  }

  return next();
};
