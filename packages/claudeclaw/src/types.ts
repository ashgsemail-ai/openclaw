/** Core configuration for the Claudeclaw server. */
export interface ClaudeclawConfig {
  anthropicApiKey: string;
  port: number;
  host: string;
  dataDir: string;
  defaultModel: string;
  logLevel: string;
}

/** Persisted state for default agent/environment IDs. */
export interface AppState {
  defaultAgentId?: string;
  defaultEnvironmentId?: string;
  agentVersion?: number;
}

/** A memory entry stored in MEMORY.md or USER.md. */
export interface MemoryData {
  memory: string;
  userProfile: string;
}

/** Metadata for a skill document. */
export interface SkillMeta {
  name: string;
  filename: string;
  created: string;
  sessionsUsed: number;
  keywords: string[];
}

/** Session metadata cached locally. */
export interface SessionRecord {
  sessionId: string;
  agentId: string;
  environmentId: string;
  title?: string;
  createdAt: string;
  status: "idle" | "running" | "terminated" | "unknown";
  toolCallCount: number;
  lastMessage?: string;
}

/** Chat request body. */
export interface ChatRequest {
  message: string;
  sessionId?: string;
  agentId?: string;
}

/** Chat response body. */
export interface ChatResponse {
  sessionId: string;
  agentId: string;
  environmentId: string;
  streamUrl: string;
}

/** Agent creation options. */
export interface CreateAgentOptions {
  name?: string;
  model?: string;
  systemPrompt?: string;
}

/** Environment creation options. */
export interface CreateEnvironmentOptions {
  name?: string;
  pipPackages?: string[];
  npmPackages?: string[];
  networking?: "unrestricted" | "limited";
}

/** Streamed event relayed to the client via SSE. */
export interface StreamedEvent {
  type: string;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  timestamp: number;
}
