import type { ToolDefinition } from "../agent/types.js";
import { loadBaldrsTargets, getListNames } from "../baldrs/data.js";
import { filterTargets } from "../baldrs/filter.js";
import { enrichTargets, type EnrichedTarget } from "../baldrs/enrich.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_ENRICH_LIMIT = 5;

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

export const tornFindTargets: ToolDefinition = {
  name: "torn_find_targets",
  description:
    "Find leveling targets from Baldr's Levelling List (curated weak/inactive players for XP farming). Filter by level, total battle stats, or specific list. Returns target profile + optionally live status from Torn API. Available lists: " +
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
      check_status: {
        type: "boolean",
        description: `Fetch live status from Torn API (Okay/Hospital/Traveling) for the top ${DEFAULT_ENRICH_LIMIT} results. Default: true.`,
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

    const top = filtered.slice(0, limit);
    const toEnrich = checkStatus
      ? top.slice(0, Math.min(DEFAULT_ENRICH_LIMIT, top.length))
      : [];
    const rest = top.slice(toEnrich.length);

    const enriched = checkStatus
      ? await enrichTargets(toEnrich, context.tornApiKey)
      : [];

    const lines = [
      `Found ${filtered.length.toLocaleString()} target(s). Showing top ${top.length}:`,
      "",
      ...enriched.map((t, i) => formatTarget(t, i)),
      ...rest.map((t, i) =>
        formatTarget(t as EnrichedTarget, enriched.length + i)
      ),
    ];

    return lines.join("\n");
  },
};
