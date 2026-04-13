import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AgentService } from "../services/agent-service.js";
import type { EnvService } from "../services/env-service.js";
import type { SessionService } from "../services/session-service.js";
import type { SkillService } from "../services/skill-service.js";
import type { ChatRequest, ChatResponse, StreamedEvent } from "../types.js";

export function chatRoutes(
  agentService: AgentService,
  envService: EnvService,
  sessionService: SessionService,
  skillService: SkillService,
): Hono {
  const app = new Hono();

  // POST /api/chat - Send a message (auto-creates agent/env/session if needed)
  app.post("/api/chat", async (c) => {
    const body = await c.req.json<ChatRequest>();

    if (!body.message) {
      return c.json({ error: "message is required" }, 400);
    }

    let sessionId = body.sessionId;
    let agentId = body.agentId;
    let environmentId: string;

    if (!sessionId) {
      // Auto-create everything on first use
      if (!agentId) {
        const agent = await agentService.getOrCreateDefaultAgent();
        agentId = agent.id;
      }

      const env = await envService.getOrCreateDefaultEnvironment();
      environmentId = env.id;

      // Find relevant skills for this task and inject into session title
      const relevantSkills = await skillService.findRelevantSkills(body.message);
      let skillContext = "";
      for (const skillFile of relevantSkills) {
        const content = await skillService.loadSkill(skillFile);
        skillContext += `\n\n<skill>\n${content}\n</skill>`;
      }

      const title = body.message.slice(0, 100);
      const session = await sessionService.createSession(agentId, environmentId, title);
      sessionId = session.sessionId;

      // If we have skill context, prepend it to the message
      const messageWithSkills = skillContext
        ? `[Relevant skills from past experience:${skillContext}]\n\n${body.message}`
        : body.message;

      await sessionService.sendMessage(sessionId, messageWithSkills);
    } else {
      // Existing session - just send the message
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }
      agentId = session.agentId;
      environmentId = session.environmentId;
      await sessionService.sendMessage(sessionId, body.message);
    }

    const response: ChatResponse = {
      sessionId,
      agentId,
      environmentId: environmentId!,
      streamUrl: `/api/chat/${sessionId}/stream`,
    };

    return c.json(response, 201);
  });

  // GET /api/chat/:sessionId/stream - SSE event stream
  app.get("/api/chat/:sessionId/stream", async (c) => {
    const { sessionId } = c.req.param();

    return streamSSE(c, async (stream) => {
      let taskMessage = "";

      const events = await sessionService.streamEvents(sessionId, (event: StreamedEvent) => {
        // Capture the first user-facing message as the task
        if (event.type === "message" && event.content && !taskMessage) {
          taskMessage = event.content;
        }

        stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      // After streaming completes, evaluate for skill creation
      if (events.length > 0 && taskMessage) {
        const skillFile = await skillService.evaluateForSkill(events, taskMessage);
        if (skillFile) {
          stream.writeSSE({
            event: "skill_created",
            data: JSON.stringify({ filename: skillFile }),
          });
        }
      }
    });
  });

  return app;
}
