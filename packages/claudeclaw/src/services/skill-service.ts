import { basename } from "node:path";
import type { FileStore } from "../store/types.js";
import type { SkillMeta, StreamedEvent } from "../types.js";

const MIN_TOOL_CALLS_FOR_SKILL = 5;

export interface SkillService {
  listSkills(): Promise<SkillMeta[]>;
  loadSkill(filename: string): Promise<string>;
  findRelevantSkills(task: string): Promise<string[]>;
  evaluateForSkill(sessionEvents: StreamedEvent[], task: string): Promise<string | null>;
  createSkill(title: string, content: string): Promise<string>;
}

export function createSkillService(store: FileStore): SkillService {
  function slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }

  function extractKeywords(text: string): string[] {
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "shall",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "at",
      "by",
      "from",
      "as",
      "into",
      "through",
      "during",
      "before",
      "after",
      "and",
      "but",
      "or",
      "nor",
      "not",
      "so",
      "yet",
      "it",
      "its",
      "this",
      "that",
      "these",
      "those",
      "i",
      "me",
      "my",
      "you",
      "your",
      "he",
      "she",
      "we",
      "they",
      "them",
      "up",
      "set",
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));
  }

  return {
    async listSkills(): Promise<SkillMeta[]> {
      const files = await store.listFiles("skills", ".md");
      const skills: SkillMeta[] = [];

      for (const file of files) {
        const content = await store.readMarkdown(`skills/${file}`);
        const createdMatch = content.match(/Created:\s*(.+)/);
        const sessionsMatch = content.match(/Sessions used:\s*(\d+)/);

        skills.push({
          name: basename(file, ".md"),
          filename: file,
          created: createdMatch?.[1] ?? "unknown",
          sessionsUsed: sessionsMatch ? parseInt(sessionsMatch[1], 10) : 0,
          keywords: extractKeywords(content.slice(0, 500)),
        });
      }

      return skills;
    },

    async loadSkill(filename: string): Promise<string> {
      return store.readMarkdown(`skills/${filename}`);
    },

    async findRelevantSkills(task: string): Promise<string[]> {
      const taskKeywords = new Set(extractKeywords(task));
      if (taskKeywords.size === 0) {
        return [];
      }

      const allSkills = await this.listSkills();
      const scored = allSkills.map((skill) => {
        const overlap = skill.keywords.filter((k) => taskKeywords.has(k)).length;
        return { skill, score: overlap };
      });

      return scored
        .filter((s) => s.score > 0)
        .toSorted((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.skill.filename);
    },

    async evaluateForSkill(sessionEvents: StreamedEvent[], task: string): Promise<string | null> {
      const toolCalls = sessionEvents.filter((e) => e.type === "tool_use");
      if (toolCalls.length < MIN_TOOL_CALLS_FOR_SKILL) {
        return null;
      }

      const existingMatches = await this.findRelevantSkills(task);
      if (existingMatches.length > 0) {
        // A relevant skill already exists — skip creation
        return null;
      }

      const title = task.slice(0, 80).trim();
      const slug = slugify(title);
      const toolNames = [...new Set(toolCalls.map((e) => e.toolName).filter(Boolean))];
      const agentMessages = sessionEvents
        .filter((e) => e.type === "message" && e.content)
        .map((e) => e.content!)
        .join("\n\n");

      const summary =
        agentMessages.length > 1000 ? agentMessages.slice(0, 1000) + "..." : agentMessages;

      const now = new Date().toISOString().split("T")[0];
      const skillContent = `# Skill: ${title}
Created: ${now}
Sessions used: 1

## Task
${task}

## Tools Used
${toolNames.map((t) => `- ${t}`).join("\n")}

## Summary
${summary}

## Pitfalls
<!-- Will be updated as this skill is reused -->

## Verification
<!-- Will be updated as this skill is reused -->
`;

      const filename = await this.createSkill(slug, skillContent);
      return filename;
    },

    async createSkill(title: string, content: string): Promise<string> {
      const filename = `${slugify(title)}.md`;
      await store.writeMarkdown(`skills/${filename}`, content);
      return filename;
    },
  };
}
