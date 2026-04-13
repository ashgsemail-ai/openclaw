import { homedir } from "node:os";
import { join } from "node:path";
import type { ClaudeclawConfig } from "./types.js";

export function loadConfig(): ClaudeclawConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required. Set it as an environment variable.");
  }

  return {
    anthropicApiKey: apiKey,
    port: parseInt(process.env.CLAUDECLAW_PORT ?? "3000", 10),
    host: process.env.CLAUDECLAW_HOST ?? "0.0.0.0",
    dataDir: process.env.CLAUDECLAW_DATA_DIR ?? join(homedir(), ".claudeclaw"),
    defaultModel: process.env.CLAUDECLAW_MODEL ?? "claude-sonnet-4-6",
    logLevel: process.env.CLAUDECLAW_LOG_LEVEL ?? "info",
  };
}
