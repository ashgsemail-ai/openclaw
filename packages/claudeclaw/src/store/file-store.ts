import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import type { FileStore } from "./types.js";

export function createFileStore(dataDir: string): FileStore {
  const resolve = (filename: string) => join(dataDir, filename);

  return {
    async init() {
      await mkdir(dataDir, { recursive: true });
      await mkdir(join(dataDir, "skills"), { recursive: true });
    },

    async readMarkdown(filename: string): Promise<string> {
      try {
        return await readFile(resolve(filename), "utf-8");
      } catch {
        return "";
      }
    },

    async writeMarkdown(filename: string, content: string): Promise<void> {
      const path = resolve(filename);
      const dir = join(path, "..");
      await mkdir(dir, { recursive: true });
      await writeFile(path, content, "utf-8");
    },

    async readJson<T>(filename: string, fallback: T): Promise<T> {
      try {
        const raw = await readFile(resolve(filename), "utf-8");
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    async writeJson<T>(filename: string, data: T): Promise<void> {
      await writeFile(resolve(filename), JSON.stringify(data, null, 2), "utf-8");
    },

    async listFiles(subdir: string, ext: string): Promise<string[]> {
      try {
        const dir = join(dataDir, subdir);
        const entries = await readdir(dir);
        return entries.filter((f) => extname(f) === ext);
      } catch {
        return [];
      }
    },

    resolve,
  };
}
