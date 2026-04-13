import { describe, it, expect, afterEach } from "vitest";
import { createAgentService } from "../../src/services/agent-service.js";
import { createMemoryService } from "../../src/services/memory-service.js";
import { createTestStore } from "../helpers.js";
import { createMockClient } from "../helpers.js";

describe("AgentService", () => {
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it("creates an agent with default settings", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const memoryService = createMemoryService(store);
    const svc = createAgentService(client, store, memoryService, "claude-sonnet-4-6");

    const agent = await svc.createAgent();
    expect(agent.id).toMatch(/^agent_/);
    expect(agent.version).toBe(1);
  });

  it("creates an agent with custom options", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const memoryService = createMemoryService(store);
    const svc = createAgentService(client, store, memoryService, "claude-sonnet-4-6");

    const agent = await svc.createAgent({
      name: "My Custom Agent",
      model: "claude-opus-4-6",
    });
    expect(agent.id).toMatch(/^agent_/);
  });

  it("gets or creates default agent", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const memoryService = createMemoryService(store);
    const svc = createAgentService(client, store, memoryService, "claude-sonnet-4-6");

    const agent1 = await svc.getOrCreateDefaultAgent();
    expect(agent1.id).toBeTruthy();

    // Second call should return the same agent
    const agent2 = await svc.getOrCreateDefaultAgent();
    expect(agent2.id).toBe(agent1.id);
  });

  it("lists agents", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const memoryService = createMemoryService(store);
    const svc = createAgentService(client, store, memoryService, "claude-sonnet-4-6");

    const agents = await svc.listAgents();
    expect(agents).toHaveLength(1);
  });

  it("has a base system prompt", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const memoryService = createMemoryService(store);
    const svc = createAgentService(client, store, memoryService, "claude-sonnet-4-6");

    const prompt = svc.getBaseSystemPrompt();
    expect(prompt).toContain("Claudeclaw");
    expect(prompt).toContain("personal AI assistant");
  });
});
