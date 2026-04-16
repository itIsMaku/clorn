import type Anthropic from "@anthropic-ai/sdk";

export interface AgentContext {
  tornApiKey: string;
  discordUserId: string;
  discordChannelId: string;
  tornPlayerId?: number;
  tornPlayerName?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Messages.Tool["input_schema"];
  handler: (input: Record<string, unknown>, context: AgentContext) => Promise<string>;
}
