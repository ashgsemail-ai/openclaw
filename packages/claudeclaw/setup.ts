/**
 * Claudeclaw Setup Script
 *
 * Run this once to create your agent and environment on Anthropic's cloud.
 * Usage: ANTHROPIC_API_KEY=sk-ant-... npx tsx setup.ts
 *
 * After running, paste the agent ID and environment ID into the app
 * or just use the web app's built-in setup (it does this automatically).
 */

const API = "https://api.anthropic.com/v1";
const BETA = "managed-agents-2026-04-01";
const API_VER = "2023-06-01";

const SYSTEM_PROMPT = `You are Claudeclaw, a personal AI assistant that lives in the cloud. You are always available, highly capable, and you get better over time.

Your core traits:
- You are proactive: anticipate what the user needs next.
- You are thorough: when given a task, complete it fully.
- You are honest: if you're unsure, say so.
- You remember: pay attention to preferences, patterns, and past requests.
- You are persistent: for long-running tasks, keep working until done.

You have a sandboxed cloud container with bash, file operations, web browsing, and code execution. Use these tools freely.

After completing complex tasks, note key learnings and pitfalls. When you learn something new about the user, mention it briefly.`;

async function apiRequest(apiKey: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VER,
      "anthropic-beta": BETA,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY environment variable first.");
    console.error("Example: ANTHROPIC_API_KEY=sk-ant-... npx tsx setup.ts");
    process.exit(1);
  }

  console.log("Setting up Claudeclaw on Anthropic's cloud...\n");

  console.log("1. Creating agent...");
  const agent = await apiRequest(apiKey, "POST", "/agents", {
    name: "Claudeclaw",
    model: "claude-sonnet-4-6",
    system: SYSTEM_PROMPT,
    tools: [{ type: "agent_toolset_20260401" }],
  });
  console.log(`   Agent ID: ${agent.id}`);
  console.log(`   Version: ${agent.version}\n`);

  console.log("2. Creating environment...");
  const env = await apiRequest(apiKey, "POST", "/environments", {
    name: "claudeclaw-env",
    config: {
      type: "cloud",
      packages: {
        pip: ["pandas", "numpy", "requests", "beautifulsoup4", "matplotlib", "scikit-learn"],
      },
      networking: { type: "unrestricted" },
    },
  });
  console.log(`   Environment ID: ${env.id}\n`);

  console.log("Done! Your Claudeclaw agent is live on Anthropic's cloud.\n");
  console.log("To use it:");
  console.log("  1. Open app/index.html in your browser");
  console.log("  2. Enter your API key");
  console.log("  3. Start chatting\n");
  console.log("Or use the Anthropic CLI:");
  console.log(`  ant beta:sessions create --agent ${agent.id} --environment-id ${env.id}`);
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
