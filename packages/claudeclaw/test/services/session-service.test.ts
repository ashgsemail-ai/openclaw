import { describe, it, expect, afterEach } from "vitest";
import { createSessionService } from "../../src/services/session-service.js";
import { createTestStore } from "../helpers.js";
import { createMockClient } from "../helpers.js";

describe("SessionService", () => {
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it("creates a session and persists it", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const svc = createSessionService(client, store);

    const session = await svc.createSession("agent_1", "env_1", "Test");
    expect(session.sessionId).toMatch(/^session_/);
    expect(session.agentId).toBe("agent_1");
    expect(session.status).toBe("idle");

    const sessions = await svc.listSessions();
    expect(sessions).toHaveLength(1);
  });

  it("retrieves a session by ID", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const svc = createSessionService(client, store);

    const created = await svc.createSession("agent_1", "env_1");
    const found = await svc.getSession(created.sessionId);
    expect(found).toBeTruthy();
    expect(found!.sessionId).toBe(created.sessionId);
  });

  it("returns undefined for unknown session", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const svc = createSessionService(client, store);

    const found = await svc.getSession("nonexistent");
    expect(found).toBeUndefined();
  });

  it("streams events and collects them", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const svc = createSessionService(client, store);

    const session = await svc.createSession("agent_1", "env_1");
    const collected: unknown[] = [];

    const events = await svc.streamEvents(session.sessionId, (event) => {
      collected.push(event);
    });

    expect(events.length).toBeGreaterThan(0);
    expect(collected.length).toBeGreaterThan(0);

    const messageEvent = events.find((e) => e.type === "message");
    expect(messageEvent?.content).toContain("Claudeclaw");
  });

  it("archives a session", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const client = createMockClient();
    const svc = createSessionService(client, store);

    const session = await svc.createSession("agent_1", "env_1");
    await svc.archiveSession(session.sessionId);

    const sessions = await svc.listSessions();
    expect(sessions).toHaveLength(0);
  });
});
