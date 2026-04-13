import { serve } from "@hono/node-server";
import { getClient } from "./client.js";
import { loadConfig } from "./config.js";
import { createApp } from "./server.js";
import { createAgentService } from "./services/agent-service.js";
import { createEnvService } from "./services/env-service.js";
import { createMemoryService } from "./services/memory-service.js";
import { createSessionService } from "./services/session-service.js";
import { createSkillService } from "./services/skill-service.js";
import { createFileStore } from "./store/file-store.js";

async function main() {
  console.log("🐾 Claudeclaw starting...");

  // Load configuration
  const config = loadConfig();
  console.log(`   Data directory: ${config.dataDir}`);
  console.log(`   Default model: ${config.defaultModel}`);

  // Initialize file store
  const store = createFileStore(config.dataDir);
  await store.init();

  // Create Anthropic client
  const client = getClient(config.anthropicApiKey);

  // Create services
  const memoryService = createMemoryService(store);
  const skillService = createSkillService(store);
  const agentService = createAgentService(client, store, memoryService, config.defaultModel);
  const envService = createEnvService(client, store);
  const sessionService = createSessionService(client, store);

  // Build the app
  const app = createApp({
    agentService,
    envService,
    sessionService,
    memoryService,
    skillService,
  });

  // Start the server
  console.log(`   Listening on http://${config.host}:${config.port}`);
  console.log("   Ready! Send your first message to /api/chat");

  serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  });
}

main().catch((err) => {
  console.error("Failed to start Claudeclaw:", err);
  process.exit(1);
});
