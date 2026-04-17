import type Anthropic from "@anthropic-ai/sdk";
import type { ToolDefinition, AgentContext } from "./types.js";
import { tornUserLookup } from "../tools/torn-user-lookup.js";
import { tornUserBars } from "../tools/torn-user-bars.js";
import { tornMarketLookup } from "../tools/torn-market-lookup.js";
import { tornItemSearch } from "../tools/torn-item-search.js";
import { tornFactionInfo } from "../tools/torn-faction-info.js";
import { monitorCreate } from "../tools/monitor-create.js";
import { monitorList } from "../tools/monitor-list.js";
import { monitorCancel } from "../tools/monitor-cancel.js";
import { tornUserMoney } from "../tools/torn-user-money.js";
import { tornFindTargets } from "../tools/torn-find-targets.js";

const allTools: ToolDefinition[] = [
  tornUserLookup,
  tornUserBars,
  tornUserMoney,
  tornMarketLookup,
  tornItemSearch,
  tornFactionInfo,
  tornFindTargets,
  monitorCreate,
  monitorList,
  monitorCancel,
];

const toolMap = new Map<string, ToolDefinition>(
  allTools.map((t) => [t.name, t])
);

export function getToolDefinitions(): Anthropic.Messages.Tool[] {
  return allTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: AgentContext
): Promise<string> {
  const tool = toolMap.get(name);
  if (!tool) {
    return `Unknown tool: ${name}`;
  }

  try {
    return await tool.handler(input, context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tool:${name}] Error:`, message);
    return `Error executing ${name}: ${message}`;
  }
}
