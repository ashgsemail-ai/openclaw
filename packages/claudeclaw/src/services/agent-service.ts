import type { ManagedAgentsClient } from "../client.js";
import type { FileStore } from "../store/types.js";
import type { AppState, CreateAgentOptions } from "../types.js";
import type { MemoryService } from "./memory-service.js";

const BASE_SYSTEM_PROMPT = `You are Claudeclaw, a personal AI assistant that lives in the cloud. You are always available, highly capable, and you get better over time.

Your core traits:
- You are proactive: anticipate what the user needs next.
- You are thorough: when given a task, complete it fully — don't stop at the first step.
- You are honest: if you're unsure, say so. If something failed, explain why.
- You remember: pay attention to the user's preferences, patterns, and past requests.
- You are persistent: for long-running tasks, keep working until done.

You have access to a sandboxed cloud container with bash, file operations, web browsing, and code execution. Use these tools freely to accomplish tasks.

After completing a complex task, note any key learnings, pitfalls, or procedures that would be useful to remember for next time.

When you learn something new about the user (their preferences, environment, conventions, or corrections they give you), mention it briefly so it can be recorded.`;

export interface AgentService {
  createAgent(opts?: CreateAgentOptions): Promise<{ id: string; version: number }>;
  getAgent(id: string): Promise<Record<string, unknown>>;
  listAgents(): Promise<Record<string, unknown>[]>;
  archiveAgent(id: string): Promise<void>;
  getOrCreateDefaultAgent(): Promise<{ id: string; version: number }>;
  getBaseSystemPrompt(): string;
}

export function createAgentService(
  client: ManagedAgentsClient,
  store: FileStore,
  memoryService: MemoryService,
  defaultModel: string,
): AgentService {
  return {
    async createAgent(opts?: CreateAgentOptions) {
      const systemPrompt = opts?.systemPrompt ?? BASE_SYSTEM_PROMPT;
      const enrichedPrompt = await memoryService.buildSystemPromptWithMemory(systemPrompt);

      const agent = await client.agents.create({
        name: opts?.name ?? "Claudeclaw",
        model: opts?.model ?? defaultModel,
        system: enrichedPrompt,
        tools: [{ type: "agent_toolset_20260401" }],
      });

      return {
        id: agent.id as string,
        version: agent.version as number,
      };
    },

    async getAgent(id: string) {
      return client.agents.retrieve(id);
    },

    async listAgents() {
      const response = await client.agents.list({ limit: 50 });
      return response.data;
    },

    async archiveAgent(id: string) {
      await client.agents.archive(id);
    },

    async getOrCreateDefaultAgent() {
      const state = await store.readJson<AppState>("state.json", {});

      if (state.defaultAgentId) {
        try {
          const agent = await client.agents.retrieve(state.defaultAgentId);
          return {
            id: agent.id as string,
            version: agent.version as number,
          };
        } catch {
          // Agent may have been deleted; create a new one
        }
      }

      const result = await this.createAgent();
      state.defaultAgentId = result.id;
      state.agentVersion = result.version;
      await store.writeJson("state.json", state);
      return result;
    },

    getBaseSystemPrompt() {
      return BASE_SYSTEM_PROMPT;
    },
  };
}
