import type { NormalizedUsage, UsageLike } from "../agents/usage.js";
import type {
  CostBreakdown,
  CostUsageTotals,
  ParsedTranscriptEntry,
  SessionLatencyStats,
} from "./session-cost-usage.types.js";
import { normalizeUsage } from "../agents/usage.js";
import { countToolResults, extractToolCallNames } from "../utils/transcript-tools.js";

export const emptyTotals = (): CostUsageTotals => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  totalCost: 0,
  inputCost: 0,
  outputCost: 0,
  cacheReadCost: 0,
  cacheWriteCost: 0,
  missingCostEntries: 0,
});

export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number") {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

export const extractCostBreakdown = (usageRaw?: UsageLike | null): CostBreakdown | undefined => {
  if (!usageRaw || typeof usageRaw !== "object") {
    return undefined;
  }
  const record = usageRaw as Record<string, unknown>;
  const cost = record.cost as Record<string, unknown> | undefined;
  if (!cost) {
    return undefined;
  }

  const total = toFiniteNumber(cost.total);
  if (total === undefined || total < 0) {
    return undefined;
  }

  return {
    total,
    input: toFiniteNumber(cost.input),
    output: toFiniteNumber(cost.output),
    cacheRead: toFiniteNumber(cost.cacheRead),
    cacheWrite: toFiniteNumber(cost.cacheWrite),
  };
};

export const parseTimestamp = (entry: Record<string, unknown>): Date | undefined => {
  const raw = entry.timestamp;
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  const message = entry.message as Record<string, unknown> | undefined;
  const messageTimestamp = toFiniteNumber(message?.timestamp);
  if (messageTimestamp !== undefined) {
    const parsed = new Date(messageTimestamp);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return undefined;
};

export const parseTranscriptEntry = (
  entry: Record<string, unknown>,
): ParsedTranscriptEntry | null => {
  const message = entry.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== "object") {
    return null;
  }

  const roleRaw = message.role;
  const role = roleRaw === "user" || roleRaw === "assistant" ? roleRaw : undefined;
  if (!role) {
    return null;
  }

  const usageRaw =
    (message.usage as UsageLike | undefined) ?? (entry.usage as UsageLike | undefined);
  const usage = usageRaw ? (normalizeUsage(usageRaw) ?? undefined) : undefined;

  const provider =
    (typeof message.provider === "string" ? message.provider : undefined) ??
    (typeof entry.provider === "string" ? entry.provider : undefined);
  const model =
    (typeof message.model === "string" ? message.model : undefined) ??
    (typeof entry.model === "string" ? entry.model : undefined);

  const costBreakdown = extractCostBreakdown(usageRaw);
  const stopReason = typeof message.stopReason === "string" ? message.stopReason : undefined;
  const durationMs = toFiniteNumber(message.durationMs ?? entry.durationMs);

  return {
    message,
    role,
    timestamp: parseTimestamp(entry),
    durationMs,
    usage,
    costTotal: costBreakdown?.total,
    costBreakdown,
    provider,
    model,
    stopReason,
    toolNames: extractToolCallNames(message),
    toolResultCounts: countToolResults(message),
  };
};

export const formatDayKey = (date: Date): string =>
  date.toLocaleDateString("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

export const computeLatencyStats = (values: number[]): SessionLatencyStats | undefined => {
  if (!values.length) {
    return undefined;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const total = sorted.reduce((sum, v) => sum + v, 0);
  const count = sorted.length;
  const p95Index = Math.max(0, Math.ceil(count * 0.95) - 1);
  return {
    count,
    avgMs: total / count,
    p95Ms: sorted[p95Index] ?? sorted[count - 1],
    minMs: sorted[0],
    maxMs: sorted[count - 1],
  };
};

export const applyUsageTotals = (totals: CostUsageTotals, usage: NormalizedUsage) => {
  totals.input += usage.input ?? 0;
  totals.output += usage.output ?? 0;
  totals.cacheRead += usage.cacheRead ?? 0;
  totals.cacheWrite += usage.cacheWrite ?? 0;
  const totalTokens =
    usage.total ??
    (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  totals.totalTokens += totalTokens;
};

export const applyCostBreakdown = (
  totals: CostUsageTotals,
  costBreakdown: CostBreakdown | undefined,
) => {
  if (costBreakdown === undefined || costBreakdown.total === undefined) {
    return;
  }
  totals.totalCost += costBreakdown.total;
  totals.inputCost += costBreakdown.input ?? 0;
  totals.outputCost += costBreakdown.output ?? 0;
  totals.cacheReadCost += costBreakdown.cacheRead ?? 0;
  totals.cacheWriteCost += costBreakdown.cacheWrite ?? 0;
};

// Legacy function for backwards compatibility (no cost breakdown available)
export const applyCostTotal = (totals: CostUsageTotals, costTotal: number | undefined) => {
  if (costTotal === undefined) {
    totals.missingCostEntries += 1;
    return;
  }
  totals.totalCost += costTotal;
};
