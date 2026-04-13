import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ManagedAgentsClient } from "../src/client.js";
import type { FileStore } from "../src/store/types.js";
import { createFileStore } from "../src/store/file-store.js";

/** Create a temporary file store for testing. Returns store + cleanup fn. */
export async function createTestStore(): Promise<{
  store: FileStore;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "claudeclaw-test-"));
  const store = createFileStore(dir);
  await store.init();
  return {
    store,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

/** Create a mock ManagedAgentsClient for testing. */
export function createMockClient(): ManagedAgentsClient {
  let agentIdCounter = 0;
  let envIdCounter = 0;
  let sessionIdCounter = 0;

  return {
    agents: {
      create: async (params: Record<string, unknown>) => ({
        id: `agent_${++agentIdCounter}`,
        version: 1,
        name: params.name,
        model: params.model,
      }),
      retrieve: async (id: string) => ({
        id,
        version: 1,
        name: "Test Agent",
        model: "claude-sonnet-4-6",
      }),
      list: async () => ({
        data: [{ id: "agent_1", version: 1, name: "Test Agent" }],
      }),
      archive: async () => {},
    },
    environments: {
      create: async (params: Record<string, unknown>) => ({
        id: `env_${++envIdCounter}`,
        name: (params as { name?: string }).name,
      }),
      retrieve: async (id: string) => ({ id, name: "Test Env" }),
      list: async () => ({
        data: [{ id: "env_1", name: "Test Env" }],
      }),
      archive: async () => {},
    },
    sessions: {
      create: async (params: Record<string, unknown>) => ({
        id: `session_${++sessionIdCounter}`,
        title: (params as { title?: string }).title ?? "Test Session",
      }),
      retrieve: async (id: string) => ({ id, status: "idle" }),
      archive: async () => {},
      events: {
        send: async () => {},
        stream: async function* () {
          yield {
            type: "agent.message",
            content: [{ type: "text", text: "Hello! I'm Claudeclaw." }],
          };
          yield {
            type: "session.status_idle",
          };
        } as unknown as () => Promise<AsyncIterable<Record<string, unknown>>>,
      },
    },
  };
}
