import { describe, it, expect } from "vitest";
import { healthRoutes } from "../../src/routes/health.js";

describe("Health Route", () => {
  it("returns ok status", async () => {
    const app = healthRoutes();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("claudeclaw");
    expect(body.timestamp).toBeTruthy();
  });
});
