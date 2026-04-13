import { Hono } from "hono";
import type { EnvService } from "../services/env-service.js";
import type { CreateEnvironmentOptions } from "../types.js";

export function environmentRoutes(envService: EnvService): Hono {
  const app = new Hono();

  app.post("/api/environments", async (c) => {
    const body = await c.req.json<CreateEnvironmentOptions>();
    const env = await envService.createEnvironment(body);
    return c.json(env, 201);
  });

  app.get("/api/environments", async (c) => {
    const envs = await envService.listEnvironments();
    return c.json({ environments: envs });
  });

  app.get("/api/environments/:id", async (c) => {
    const { id } = c.req.param();
    const env = await envService.getEnvironment(id);
    return c.json(env);
  });

  app.delete("/api/environments/:id", async (c) => {
    const { id } = c.req.param();
    await envService.archiveEnvironment(id);
    return c.json({ archived: true });
  });

  return app;
}
