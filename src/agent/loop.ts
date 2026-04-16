import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { getToolDefinitions, executeTool } from "./tools.js";
import type { AgentContext } from "./types.js";
import { loadConversation, saveConversation } from "./conversation.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const MAX_ITERATIONS = 10;

export async function runAgentLoop(
  userMessage: string,
  context: AgentContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context);
  const tools = getToolDefinitions();

  // Load previous conversation history
  const history = await loadConversation(
    context.discordChannelId,
    context.discordUserId
  );
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let iterations = 0;
  let responseText = "";

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: config.CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Collect text and tool_use blocks
    const textParts: string[] = [];
    const toolUseBlocks: Anthropic.Messages.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // If no tool calls, return the text response
    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      responseText = textParts.join("\n") || "No response.";

      // Save conversation with the new exchange
      messages.push({ role: "assistant", content: response.content });
      await saveConversation(
        context.discordChannelId,
        context.discordUserId,
        messages
      );

      return responseText;
    }

    // Execute tool calls in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        console.log(`[agent] Calling tool: ${toolUse.name}`, toolUse.input);
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          context
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      })
    );

    // Append assistant message and tool results
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    console.log(
      `[agent] Iteration ${iterations}, tokens: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`
    );
  }

  responseText =
    "Maximum iteration count exceeded. Try again with a simpler query.";

  await saveConversation(
    context.discordChannelId,
    context.discordUserId,
    messages
  );

  return responseText;
}
