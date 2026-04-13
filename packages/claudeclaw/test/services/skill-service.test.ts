import { describe, it, expect, afterEach } from "vitest";
import type { StreamedEvent } from "../../src/types.js";
import { createSkillService } from "../../src/services/skill-service.js";
import { createTestStore } from "../helpers.js";

describe("SkillService", () => {
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it("returns empty list when no skills exist", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    const skills = await svc.listSkills();
    expect(skills).toEqual([]);
  });

  it("creates and lists a skill", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    await svc.createSkill("test-skill", "# Skill: Test\nSome content");
    const skills = await svc.listSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("test-skill");
  });

  it("loads skill content", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    await svc.createSkill("my-skill", "# Skill: My Skill\nDetailed steps");
    const content = await svc.loadSkill("my-skill.md");
    expect(content).toContain("Detailed steps");
  });

  it("finds relevant skills by keyword matching", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    await svc.createSkill(
      "nextjs-setup",
      "# Skill: Next.js Setup\nCreate nextjs project with tailwind css",
    );
    await svc.createSkill(
      "python-analysis",
      "# Skill: Python Analysis\nData analysis with pandas numpy",
    );

    const matches = await svc.findRelevantSkills("set up a nextjs project");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe("nextjs-setup.md");
  });

  it("returns empty when no skills match", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    await svc.createSkill("react-app", "# Skill: React App\nCreate react application");

    const matches = await svc.findRelevantSkills("deploy kubernetes cluster");
    expect(matches).toHaveLength(0);
  });

  it("evaluates session for skill creation when enough tool calls", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    const events: StreamedEvent[] = [
      { type: "message", content: "Starting the task", timestamp: 1 },
      { type: "tool_use", toolName: "bash", timestamp: 2 },
      { type: "tool_use", toolName: "file_write", timestamp: 3 },
      { type: "tool_use", toolName: "bash", timestamp: 4 },
      { type: "tool_use", toolName: "web_search", timestamp: 5 },
      { type: "tool_use", toolName: "bash", timestamp: 6 },
      { type: "message", content: "Task completed", timestamp: 7 },
    ];

    const filename = await svc.evaluateForSkill(events, "Deploy a Docker app");
    expect(filename).toBeTruthy();
    expect(filename).toContain("deploy");

    const skills = await svc.listSkills();
    expect(skills).toHaveLength(1);
  });

  it("skips skill creation when too few tool calls", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    const events: StreamedEvent[] = [
      { type: "message", content: "Quick answer", timestamp: 1 },
      { type: "tool_use", toolName: "bash", timestamp: 2 },
    ];

    const filename = await svc.evaluateForSkill(events, "Simple question");
    expect(filename).toBeNull();
  });

  it("skips skill creation when similar skill exists", async () => {
    const { store, cleanup: c } = await createTestStore();
    cleanup = c;
    const svc = createSkillService(store);

    await svc.createSkill(
      "docker-deploy",
      "# Skill: Docker Deploy\nDeploy docker application container",
    );

    const events: StreamedEvent[] = Array.from({ length: 6 }, (_, i) => ({
      type: "tool_use" as const,
      toolName: "bash",
      timestamp: i,
    }));

    const filename = await svc.evaluateForSkill(events, "Deploy docker app");
    expect(filename).toBeNull();
  });
});
