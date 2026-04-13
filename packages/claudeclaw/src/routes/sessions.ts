import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SessionService } from "../services/session-service.js";
import type { StreamedEvent } from "../types.js";

export function sessionRoutes(sessionService: SessionService): Hono {
  const app = new Hono();

  app.post("/api/sessions", async (c) => {
    const body = await c.req.json<{
      agentId: string;
      environmentId: string;
      title?: string;
    }>();
    if (!body.agentId || !body.environmentId) {
      return c.json({ error: "agentId and environmentId are required" }, 400);
    }
    const session = await sessionService.createSession(
      body.agentId,
      body.environmentId,
      body.title,
    );
    return c.json(session, 201);
  });

  app.get("/api/sessions", async (c) => {
    const sessions = await sessionService.listSessions();
    return c.json({ sessions });
  });

  app.get("/api/sessions/:id", async (c) => {
    const { id } = c.req.param();
    const session = await sessionService.getSession(id);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(session);
  });

  app.delete("/api/sessions/:id", async (c) => {
    const { id } = c.req.param();
    await sessionService.archiveSession(id);
    return c.json({ archived: true });
  });

  app.post("/api/sessions/:id/messages", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json<{ message: string }>();
    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }
    await sessionService.sendMessage(id, body.message);
    return c.json({ sent: true });
  });

  app.get("/api/sessions/:id/stream", async (c) => {
    const { id } = c.req.param();
    return streamSSE(c, async (stream) => {
      await sessionService.streamEvents(id, (event: StreamedEvent) => {
        stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });
    });
  });

  return app;
}
