import { Hono } from "hono";
import type { AgentService } from "../services/agent-service.js";
import type { CreateAgentOptions } from "../types.js";

export function agentRoutes(agentService: AgentService): Hono {
  const app = new Hono();

  app.post("/api/agents", async (c) => {
    const body = await c.req.json<CreateAgentOptions>();
    const agent = await agentService.createAgent(body);
    return c.json(agent, 201);
  });

  app.get("/api/agents", async (c) => {
    const agents = await agentService.listAgents();
    return c.json({ agents });
  });

  app.get("/api/agents/:id", async (c) => {
    const { id } = c.req.param();
    const agent = await agentService.getAgent(id);
    return c.json(agent);
  });

  app.delete("/api/agents/:id", async (c) => {
    const { id } = c.req.param();
    await agentService.archiveAgent(id);
    return c.json({ archived: true });
  });

  return app;
}
