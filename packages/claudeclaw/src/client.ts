const API_BASE = "https://api.anthropic.com/v1";
const BETA_HEADER = "managed-agents-2026-04-01";
const API_VERSION = "2023-06-01";

export interface ManagedAgentsClient {
  agents: {
    create(params: Record<string, unknown>): Promise<Record<string, unknown>>;
    retrieve(id: string): Promise<Record<string, unknown>>;
    list(params?: Record<string, unknown>): Promise<{ data: Record<string, unknown>[] }>;
    archive(id: string): Promise<void>;
  };
  environments: {
    create(params: Record<string, unknown>): Promise<Record<string, unknown>>;
    retrieve(id: string): Promise<Record<string, unknown>>;
    list(params?: Record<string, unknown>): Promise<{ data: Record<string, unknown>[] }>;
    archive(id: string): Promise<void>;
  };
  sessions: {
    create(params: Record<string, unknown>): Promise<Record<string, unknown>>;
    retrieve(id: string): Promise<Record<string, unknown>>;
    archive(id: string): Promise<void>;
    events: {
      send(sessionId: string, body: Record<string, unknown>): Promise<void>;
      stream(sessionId: string): Promise<AsyncIterable<Record<string, unknown>>>;
    };
  };
}

async function request(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-beta": BETA_HEADER,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  if (res.status === 204) {
    return undefined;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return undefined;
}

async function* streamSSE(apiKey: string, path: string): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-beta": BETA_HEADER,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic stream error ${res.status}: ${text}`);
  }

  if (!res.body) {
    throw new Error("No response body for SSE stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData += line.slice(6);
        } else if (line === "" && currentData) {
          try {
            const parsed = JSON.parse(currentData);
            yield { type: currentEvent || parsed.type, ...parsed };
          } catch {
            yield { type: currentEvent, raw: currentData };
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

let cachedClient: ManagedAgentsClient | null = null;

export function getClient(apiKey: string): ManagedAgentsClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = {
    agents: {
      async create(params) {
        return (await request(apiKey, "POST", "/agents", params)) as Record<string, unknown>;
      },
      async retrieve(id) {
        return (await request(apiKey, "GET", `/agents/${id}`)) as Record<string, unknown>;
      },
      async list(params) {
        const qs = params?.limit ? `?limit=${params.limit}` : "";
        return (await request(apiKey, "GET", `/agents${qs}`)) as {
          data: Record<string, unknown>[];
        };
      },
      async archive(id) {
        await request(apiKey, "POST", `/agents/${id}/archive`);
      },
    },
    environments: {
      async create(params) {
        return (await request(apiKey, "POST", "/environments", params)) as Record<string, unknown>;
      },
      async retrieve(id) {
        return (await request(apiKey, "GET", `/environments/${id}`)) as Record<string, unknown>;
      },
      async list(params) {
        const qs = params?.limit ? `?limit=${params.limit}` : "";
        return (await request(apiKey, "GET", `/environments${qs}`)) as {
          data: Record<string, unknown>[];
        };
      },
      async archive(id) {
        await request(apiKey, "POST", `/environments/${id}/archive`);
      },
    },
    sessions: {
      async create(params) {
        return (await request(apiKey, "POST", "/sessions", params)) as Record<string, unknown>;
      },
      async retrieve(id) {
        return (await request(apiKey, "GET", `/sessions/${id}`)) as Record<string, unknown>;
      },
      async archive(id) {
        await request(apiKey, "POST", `/sessions/${id}/archive`);
      },
      events: {
        async send(sessionId, body) {
          await request(apiKey, "POST", `/sessions/${sessionId}/events`, body);
        },
        async stream(sessionId) {
          return streamSSE(apiKey, `/sessions/${sessionId}/stream`);
        },
      },
    },
  };

  return cachedClient;
}

export function resetClient(): void {
  cachedClient = null;
}
