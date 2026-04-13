import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AgentService } from "./services/agent-service.js";
import type { EnvService } from "./services/env-service.js";
import type { MemoryService } from "./services/memory-service.js";
import type { SessionService } from "./services/session-service.js";
import type { SkillService } from "./services/skill-service.js";
import { agentRoutes } from "./routes/agents.js";
import { chatRoutes } from "./routes/chat.js";
import { environmentRoutes } from "./routes/environments.js";
import { healthRoutes } from "./routes/health.js";
import { memoryRoutes } from "./routes/memory.js";
import { sessionRoutes } from "./routes/sessions.js";

export interface Services {
  agentService: AgentService;
  envService: EnvService;
  sessionService: SessionService;
  memoryService: MemoryService;
  skillService: SkillService;
}

export function createApp(services: Services): Hono {
  const app = new Hono();

  // Middleware
  app.use("*", cors());

  // Error handling
  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    const message = err.message || "Internal server error";
    console.error(`[${c.req.method}] ${c.req.path} - ${status}: ${message}`);
    return c.json({ error: message }, status as 400);
  });

  // Routes
  app.route("/", healthRoutes());
  app.route(
    "/",
    chatRoutes(
      services.agentService,
      services.envService,
      services.sessionService,
      services.skillService,
    ),
  );
  app.route("/", agentRoutes(services.agentService));
  app.route("/", environmentRoutes(services.envService));
  app.route("/", sessionRoutes(services.sessionService));
  app.route("/", memoryRoutes(services.memoryService, services.skillService));

  return app;
}
