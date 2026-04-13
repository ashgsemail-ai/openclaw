import type { ManagedAgentsClient } from "../client.js";
import type { FileStore } from "../store/types.js";
import type { SessionRecord, StreamedEvent } from "../types.js";

export interface SessionService {
  createSession(agentId: string, environmentId: string, title?: string): Promise<SessionRecord>;
  sendMessage(sessionId: string, text: string): Promise<void>;
  streamEvents(
    sessionId: string,
    onEvent: (event: StreamedEvent) => void,
  ): Promise<StreamedEvent[]>;
  getSession(sessionId: string): Promise<SessionRecord | undefined>;
  listSessions(): Promise<SessionRecord[]>;
  archiveSession(sessionId: string): Promise<void>;
}

export function createSessionService(
  client: ManagedAgentsClient,
  store: FileStore,
): SessionService {
  async function loadSessions(): Promise<SessionRecord[]> {
    return store.readJson<SessionRecord[]>("sessions.json", []);
  }

  async function saveSessions(sessions: SessionRecord[]): Promise<void> {
    await store.writeJson("sessions.json", sessions);
  }

  async function upsertSession(record: SessionRecord): Promise<void> {
    const sessions = await loadSessions();
    const idx = sessions.findIndex((s) => s.sessionId === record.sessionId);
    if (idx >= 0) {
      sessions[idx] = record;
    } else {
      sessions.push(record);
    }
    await saveSessions(sessions);
  }

  return {
    async createSession(agentId, environmentId, title?) {
      const session = await client.sessions.create({
        agent: agentId,
        environment_id: environmentId,
        title: title ?? `Session ${new Date().toISOString()}`,
      });

      const record: SessionRecord = {
        sessionId: session.id as string,
        agentId,
        environmentId,
        title: (title ?? session.title) as string,
        createdAt: new Date().toISOString(),
        status: "idle",
        toolCallCount: 0,
      };

      await upsertSession(record);
      return record;
    },

    async sendMessage(sessionId, text) {
      await client.sessions.events.send(sessionId, {
        events: [
          {
            type: "user.message",
            content: [{ type: "text", text }],
          },
        ],
      });
    },

    async streamEvents(sessionId, onEvent) {
      const allEvents: StreamedEvent[] = [];
      const stream = await client.sessions.events.stream(sessionId);

      for await (const event of stream) {
        const now = Date.now();
        const eventType = event.type as string;

        switch (eventType) {
          case "agent.message": {
            const content = event.content;
            const textBlocks = Array.isArray(content)
              ? (content as Record<string, unknown>[])
                  .filter((b) => b.type === "text")
                  .map((b) => b.text as string)
                  .join("")
              : "";
            const streamed: StreamedEvent = {
              type: "message",
              content: textBlocks,
              timestamp: now,
            };
            allEvents.push(streamed);
            onEvent(streamed);
            break;
          }

          case "agent.tool_use": {
            const streamed: StreamedEvent = {
              type: "tool_use",
              toolName: event.name as string,
              toolInput: event.input,
              timestamp: now,
            };
            allEvents.push(streamed);
            onEvent(streamed);
            break;
          }

          case "session.status_idle": {
            const streamed: StreamedEvent = { type: "idle", timestamp: now };
            allEvents.push(streamed);
            onEvent(streamed);

            const sessions = await loadSessions();
            const session = sessions.find((s) => s.sessionId === sessionId);
            if (session) {
              session.status = "idle";
              session.toolCallCount = allEvents.filter((e) => e.type === "tool_use").length;
              const lastMsg = allEvents.findLast((e) => e.type === "message");
              if (lastMsg?.content) {
                session.lastMessage = lastMsg.content.slice(0, 200);
              }
              await saveSessions(sessions);
            }
            return allEvents;
          }

          case "session.status_terminated": {
            const streamed: StreamedEvent = {
              type: "terminated",
              timestamp: now,
            };
            allEvents.push(streamed);
            onEvent(streamed);

            const sessions = await loadSessions();
            const session = sessions.find((s) => s.sessionId === sessionId);
            if (session) {
              session.status = "terminated";
              await saveSessions(sessions);
            }
            return allEvents;
          }

          default: {
            const streamed: StreamedEvent = {
              type: eventType,
              timestamp: now,
            };
            allEvents.push(streamed);
            onEvent(streamed);
          }
        }
      }

      return allEvents;
    },

    async getSession(sessionId) {
      const sessions = await loadSessions();
      return sessions.find((s) => s.sessionId === sessionId);
    },

    async listSessions() {
      return loadSessions();
    },

    async archiveSession(sessionId) {
      await client.sessions.archive(sessionId);
      const sessions = await loadSessions();
      const filtered = sessions.filter((s) => s.sessionId !== sessionId);
      await saveSessions(filtered);
    },
  };
}
