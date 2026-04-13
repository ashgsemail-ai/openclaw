import type { FileStore } from "../store/types.js";
import type { MemoryData } from "../types.js";

const DEFAULT_MEMORY = `# Memory
<!-- Claudeclaw will update this file as it learns about you and your environment. -->
`;

const DEFAULT_USER_PROFILE = `# User Profile
<!-- Claudeclaw will update this file as it learns your preferences and communication style. -->
`;

export interface MemoryService {
  loadMemory(): Promise<MemoryData>;
  updateMemory(content: string): Promise<void>;
  updateUserProfile(content: string): Promise<void>;
  buildSystemPromptWithMemory(basePrompt: string): Promise<string>;
}

export function createMemoryService(store: FileStore): MemoryService {
  return {
    async loadMemory(): Promise<MemoryData> {
      const [memory, userProfile] = await Promise.all([
        store.readMarkdown("MEMORY.md"),
        store.readMarkdown("USER.md"),
      ]);
      return {
        memory: memory || DEFAULT_MEMORY,
        userProfile: userProfile || DEFAULT_USER_PROFILE,
      };
    },

    async updateMemory(content: string): Promise<void> {
      await store.writeMarkdown("MEMORY.md", content);
    },

    async updateUserProfile(content: string): Promise<void> {
      await store.writeMarkdown("USER.md", content);
    },

    async buildSystemPromptWithMemory(basePrompt: string): Promise<string> {
      const { memory, userProfile } = await this.loadMemory();
      const parts = [basePrompt];

      if (memory && memory !== DEFAULT_MEMORY) {
        parts.push("\n\n<memory>\n" + memory.trim() + "\n</memory>");
      }

      if (userProfile && userProfile !== DEFAULT_USER_PROFILE) {
        parts.push("\n\n<user-profile>\n" + userProfile.trim() + "\n</user-profile>");
      }

      return parts.join("");
    },
  };
}
