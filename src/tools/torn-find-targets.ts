import type { ToolDefinition } from "../agent/types.js";
import { loadBaldrsTargets, getListNames } from "../baldrs/data.js";
import { filterTargets } from "../baldrs/filter.js";
import { enrichTargets, type EnrichedTarget } from "../baldrs/enrich.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const OVERFETCH_MULTIPLIER = 3; // fetch this many times `limit` to survive hospital filtering
const MAX_OVERFETCH = 100;

function formatTarget(t: EnrichedTarget, index: number): string {
  const statusLine = t.fetchFailed
    ? ""
    : t.statusState
      ? `\n   Status: ${t.statusDescription ?? t.statusState}` +
        (t.lastAction ? ` | Last action: ${t.lastAction}` : "")
      : "";
  const levelChange =
    t.currentLevel && t.currentLevel !== t.level
      ? ` → L${t.currentLevel} now`
      : "";
  return (
    `${index + 1}. **${t.name}** [${t.id}] — L${t.level}${levelChange}, ${t.total.toLocaleString()} total (${t.str}/${t.def}/${t.spd}/${t.dex})` +
    `\n   List: ${t.listName}` +
    statusLine
  );
}

function isAttackable(t: EnrichedTarget): boolean {
  // If fetch failed, be conservative and include them
  if (t.fetchFailed) return true;
  // No status info means checkStatus was false; include them
  if (!t.statusState) return true;
  return t.statusState === "Okay";
}

export const tornFindTargets: ToolDefinition = {
  name: "torn_find_targets",
  description:
    "Find leveling targets from Baldr's Levelling List (curated weak/inactive players for XP farming). Filter by level, total battle stats, or specific list. By default, only returns targets that are Okay (not in hospital or traveling). Available lists: " +
    getListNames().join(", "),
  input_schema: {
    type: "object" as const,
    properties: {
      max_level: {
        type: "number",
        description: "Maximum target level (e.g. 30 = only targets L30 and below)",
      },
      min_level: {
        type: "number",
        description: "Minimum target level",
      },
      max_total: {
        type: "number",
        description: "Maximum total battle stats (e.g. 500 = only weak targets)",
      },
      min_total: {
        type: "number",
        description: "Minimum total battle stats",
      },
      list_name: {
        type: "string",
        description:
          "Filter to a specific list (fuzzy match). Available: " +
          getListNames().join(", "),
      },
      limit: {
        type: "number",
        description: `How many targets to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`,
      },
      sort_by: {
        type: "string",
        enum: ["total", "level"],
        description: "Sort by total stats (default) or level",
      },
      include_hospital: {
        type: "boolean",
        description:
          "Include targets currently in hospital or traveling. Default: false (only Okay targets are returned).",
      },
      check_status: {
        type: "boolean",
        description:
          "Fetch live status from Torn API. Default: true. Set to false to skip API calls and return raw list entries without filtering by status.",
      },
    },
    required: [],
  },
  handler: async (input, context) => {
    const all = loadBaldrsTargets();
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, (input.limit as number) ?? DEFAULT_LIMIT)
    );
    const checkStatus = (input.check_status as boolean) ?? true;
    const includeHospital = (input.include_hospital as boolean) ?? false;

    const filtered = filterTargets(all, {
      maxLevel: input.max_level as number | undefined,
      minLevel: input.min_level as number | undefined,
      maxTotal: input.max_total as number | undefined,
      minTotal: input.min_total as number | undefined,
      listName: input.list_name as string | undefined,
      sortBy: (input.sort_by as "total" | "level" | undefined) ?? "total",
    });

    if (filtered.length === 0) {
      return "No targets match those criteria.";
    }

    let results: EnrichedTarget[];

    if (!checkStatus) {
      results = filtered.slice(0, limit) as EnrichedTarget[];
    } else {
      // Over-fetch so we can filter out hospital/travel and still hit `limit`
      const fetchCount = Math.min(
        MAX_OVERFETCH,
        filtered.length,
        includeHospital ? limit : limit * OVERFETCH_MULTIPLIER
      );
      const candidates = filtered.slice(0, fetchCount);
      const enriched = await enrichTargets(candidates, context.tornApiKey);

      results = includeHospital
        ? enriched.slice(0, limit)
        : enriched.filter(isAttackable).slice(0, limit);
    }

    if (results.length === 0) {
      return `All top targets are currently in hospital or traveling. Try increasing the filter range or pass include_hospital=true.`;
    }

    const hospitalNote =
      checkStatus && !includeHospital
        ? " (hospital/traveling targets hidden; pass include_hospital to see them)"
        : "";

    const lines = [
      `Found ${filtered.length.toLocaleString()} target(s). Showing ${results.length}${hospitalNote}:`,
      "",
      ...results.map((t, i) => formatTarget(t, i)),
    ];

    return lines.join("\n");
  },
};
