import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const binaryCache = new Map<string, Promise<string | null>>();

export function expandHomeDir(value: string): string {
  if (!value.startsWith("~")) {
    return value;
  }
  const home = os.homedir();
  if (value === "~") {
    return home;
  }
  if (value.startsWith("~/")) {
    return path.join(home, value.slice(2));
  }
  return value;
}

export function hasPathSeparator(value: string): boolean {
  return value.includes("/") || value.includes("\\");
}

export function candidateBinaryNames(name: string): string[] {
  if (process.platform !== "win32") {
    return [name];
  }
  const ext = path.extname(name);
  if (ext) {
    return [name];
  }
  const pathext = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith(".") ? item : `.${item}`));
  const unique = Array.from(new Set(pathext));
  return [name, ...unique.map((item) => `${name}${item}`)];
}

export async function isExecutable(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return false;
    }
    if (process.platform === "win32") {
      return true;
    }
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findBinary(name: string): Promise<string | null> {
  const cached = binaryCache.get(name);
  if (cached) {
    return cached;
  }
  const resolved = (async () => {
    const direct = expandHomeDir(name.trim());
    if (direct && hasPathSeparator(direct)) {
      for (const candidate of candidateBinaryNames(direct)) {
        if (await isExecutable(candidate)) {
          return candidate;
        }
      }
    }

    const searchName = name.trim();
    if (!searchName) {
      return null;
    }
    const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
    const candidates = candidateBinaryNames(searchName);
    for (const entryRaw of pathEntries) {
      const entry = expandHomeDir(entryRaw.trim().replace(/^"(.*)"$/, "$1"));
      if (!entry) {
        continue;
      }
      for (const candidate of candidates) {
        const fullPath = path.join(entry, candidate);
        if (await isExecutable(fullPath)) {
          return fullPath;
        }
      }
    }

    return null;
  })();
  binaryCache.set(name, resolved);
  return resolved;
}

export async function hasBinary(name: string): Promise<boolean> {
  return Boolean(await findBinary(name));
}

export async function fileExists(filePath?: string | null): Promise<boolean> {
  if (!filePath) {
    return false;
  }
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
