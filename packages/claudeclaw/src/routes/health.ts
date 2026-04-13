import { Hono } from "hono";

export function healthRoutes(): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      service: "claudeclaw",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
