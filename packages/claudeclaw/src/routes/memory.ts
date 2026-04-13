import { Hono } from "hono";
import type { MemoryService } from "../services/memory-service.js";
import type { SkillService } from "../services/skill-service.js";

export function memoryRoutes(memoryService: MemoryService, skillService: SkillService): Hono {
  const app = new Hono();

  // GET /api/memory - Read current memory + user profile
  app.get("/api/memory", async (c) => {
    const data = await memoryService.loadMemory();
    return c.json(data);
  });

  // PUT /api/memory - Update memory and/or user profile
  app.put("/api/memory", async (c) => {
    const body = await c.req.json<{ memory?: string; userProfile?: string }>();
    if (body.memory !== undefined) {
      await memoryService.updateMemory(body.memory);
    }
    if (body.userProfile !== undefined) {
      await memoryService.updateUserProfile(body.userProfile);
    }
    const data = await memoryService.loadMemory();
    return c.json(data);
  });

  // GET /api/skills - List all skill documents
  app.get("/api/skills", async (c) => {
    const skills = await skillService.listSkills();
    return c.json({ skills });
  });

  // GET /api/skills/:name - Read a specific skill
  app.get("/api/skills/:name", async (c) => {
    const { name } = c.req.param();
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    const content = await skillService.loadSkill(filename);
    if (!content) {
      return c.json({ error: "Skill not found" }, 404);
    }
    return c.json({ name, content });
  });

  return app;
}
