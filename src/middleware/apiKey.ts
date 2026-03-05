import { timingSafeEqual } from "crypto";
import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  if (!config.apiKey) {
    return next();
  }

  const auth = c.req.header("Authorization");
  const expected = `Bearer ${config.apiKey}`;
  if (!auth || auth.length !== expected.length) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
      401
    );
  }

  const valid = timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!valid) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
      401
    );
  }

  return next();
};
