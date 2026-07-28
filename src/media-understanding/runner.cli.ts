import fs from "node:fs/promises";
import path from "node:path";
import { runExec } from "../process/exec.js";
import { hasBinary, fileExists } from "./runner.binary.js";

const geminiProbeCache = new Map<string, Promise<boolean>>();

export function extractLastJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.lastIndexOf("{");
  if (start === -1) {
    return null;
  }
  const slice = trimmed.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export function extractGeminiResponse(raw: string): string | null {
  const payload = extractLastJsonObject(raw);
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const response = (payload as { response?: unknown }).response;
  if (typeof response !== "string") {
    return null;
  }
  const trimmed = response.trim();
  return trimmed || null;
}

export function extractSherpaOnnxText(raw: string): string | null {
  const tryParse = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const head = trimmed[0];
    if (head !== "{" && head !== '"') {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "string") {
        return tryParse(parsed);
      }
      if (parsed && typeof parsed === "object") {
        const text = (parsed as { text?: unknown }).text;
        if (typeof text === "string" && text.trim()) {
          return text.trim();
        }
      }
    } catch {}
    return null;
  };

  const direct = tryParse(raw);
  if (direct) {
    return direct;
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = tryParse(lines[i] ?? "");
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

export async function probeGeminiCli(): Promise<boolean> {
  const cached = geminiProbeCache.get("gemini");
  if (cached) {
    return cached;
  }
  const resolved = (async () => {
    if (!(await hasBinary("gemini"))) {
      return false;
    }
    try {
      const { stdout } = await runExec("gemini", ["--output-format", "json", "ok"], {
        timeoutMs: 8000,
      });
      return Boolean(extractGeminiResponse(stdout) ?? stdout.toLowerCase().includes("ok"));
    } catch {
      return false;
    }
  })();
  geminiProbeCache.set("gemini", resolved);
  return resolved;
}

export function trimOutput(text: string, maxChars?: number): string {
  const trimmed = text.trim();
  if (!maxChars || trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(0, maxChars).trim();
}

export function commandBase(command: string): string {
  return path.parse(command).name;
}

export function findArgValue(args: string[], keys: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    if (keys.includes(args[i] ?? "")) {
      const value = args[i + 1];
      if (value) {
        return value;
      }
    }
  }
  return undefined;
}

export function hasArg(args: string[], keys: string[]): boolean {
  return args.some((arg) => keys.includes(arg));
}

export function resolveWhisperOutputPath(args: string[], mediaPath: string): string | null {
  const outputDir = findArgValue(args, ["--output_dir", "-o"]);
  const outputFormat = findArgValue(args, ["--output_format"]);
  if (!outputDir || !outputFormat) {
    return null;
  }
  const formats = outputFormat.split(",").map((value) => value.trim());
  if (!formats.includes("txt")) {
    return null;
  }
  const base = path.parse(mediaPath).name;
  return path.join(outputDir, `${base}.txt`);
}

export function resolveWhisperCppOutputPath(args: string[]): string | null {
  if (!hasArg(args, ["-otxt", "--output-txt"])) {
    return null;
  }
  const outputBase = findArgValue(args, ["-of", "--output-file"]);
  if (!outputBase) {
    return null;
  }
  return `${outputBase}.txt`;
}

export async function resolveCliOutput(params: {
  command: string;
  args: string[];
  stdout: string;
  mediaPath: string;
}): Promise<string> {
  const commandId = commandBase(params.command);
  const fileOutput =
    commandId === "whisper-cli"
      ? resolveWhisperCppOutputPath(params.args)
      : commandId === "whisper"
        ? resolveWhisperOutputPath(params.args, params.mediaPath)
        : null;
  if (fileOutput && (await fileExists(fileOutput))) {
    try {
      const content = await fs.readFile(fileOutput, "utf8");
      if (content.trim()) {
        return content.trim();
      }
    } catch {}
  }

  if (commandId === "gemini") {
    const response = extractGeminiResponse(params.stdout);
    if (response) {
      return response;
    }
  }

  if (commandId === "sherpa-onnx-offline") {
    const response = extractSherpaOnnxText(params.stdout);
    if (response) {
      return response;
    }
  }

  return params.stdout.trim();
}
