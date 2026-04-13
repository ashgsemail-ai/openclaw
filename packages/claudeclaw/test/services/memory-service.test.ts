import { describe, it, expect, afterEach } from "vitest";
import { createMemoryService } from "../../src/services/memory-service.js";
import { createTestStore } from "../helpers.js";

describe("MemoryService", () => {
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it("returns default memory when files don't exist", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createMemoryService(store);

    const data = await svc.loadMemory();
    expect(data.memory).toContain("# Memory");
    expect(data.userProfile).toContain("# User Profile");
  });

  it("updates and reads back memory", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createMemoryService(store);

    await svc.updateMemory("# Memory\n- User likes TypeScript");
    const data = await svc.loadMemory();
    expect(data.memory).toContain("User likes TypeScript");
  });

  it("updates and reads back user profile", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createMemoryService(store);

    await svc.updateUserProfile("# User Profile\nPrefers concise responses");
    const data = await svc.loadMemory();
    expect(data.userProfile).toContain("Prefers concise responses");
  });

  it("injects memory into system prompt", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createMemoryService(store);

    await svc.updateMemory("# Memory\n- Uses pnpm");
    await svc.updateUserProfile("# User Profile\nDeveloper");

    const prompt = await svc.buildSystemPromptWithMemory("You are helpful.");
    expect(prompt).toContain("You are helpful.");
    expect(prompt).toContain("<memory>");
    expect(prompt).toContain("Uses pnpm");
    expect(prompt).toContain("<user-profile>");
    expect(prompt).toContain("Developer");
  });

  it("does not inject memory tags when files are default", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createMemoryService(store);

    const prompt = await svc.buildSystemPromptWithMemory("Base prompt");
    expect(prompt).toBe("Base prompt");
    expect(prompt).not.toContain("<memory>");
  });
});
