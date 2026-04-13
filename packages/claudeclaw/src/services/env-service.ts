import type { ManagedAgentsClient } from "../client.js";
import type { FileStore } from "../store/types.js";
import type { AppState, CreateEnvironmentOptions } from "../types.js";

const DEFAULT_PIP_PACKAGES = [
  "pandas",
  "numpy",
  "requests",
  "beautifulsoup4",
  "matplotlib",
  "scikit-learn",
];

export interface EnvService {
  createEnvironment(opts?: CreateEnvironmentOptions): Promise<{ id: string }>;
  getEnvironment(id: string): Promise<Record<string, unknown>>;
  listEnvironments(): Promise<Record<string, unknown>[]>;
  archiveEnvironment(id: string): Promise<void>;
  getOrCreateDefaultEnvironment(): Promise<{ id: string }>;
}

export function createEnvService(client: ManagedAgentsClient, store: FileStore): EnvService {
  return {
    async createEnvironment(opts?: CreateEnvironmentOptions) {
      const env = await client.environments.create({
        name: opts?.name ?? "claudeclaw-default",
        config: {
          type: "cloud",
          packages: {
            pip: opts?.pipPackages ?? DEFAULT_PIP_PACKAGES,
            ...(opts?.npmPackages ? { npm: opts.npmPackages } : {}),
          },
          networking: { type: opts?.networking ?? "unrestricted" },
        },
      });

      return { id: env.id as string };
    },

    async getEnvironment(id: string) {
      return client.environments.retrieve(id);
    },

    async listEnvironments() {
      const response = await client.environments.list({ limit: 50 });
      return response.data;
    },

    async archiveEnvironment(id: string) {
      await client.environments.archive(id);
    },

    async getOrCreateDefaultEnvironment() {
      const state = await store.readJson<AppState>("state.json", {});

      if (state.defaultEnvironmentId) {
        try {
          await client.environments.retrieve(state.defaultEnvironmentId);
          return { id: state.defaultEnvironmentId };
        } catch {
          // Environment may have been deleted; create a new one
        }
      }

      const result = await this.createEnvironment();
      state.defaultEnvironmentId = result.id;
      await store.writeJson("state.json", state);
      return result;
    },
  };
}
