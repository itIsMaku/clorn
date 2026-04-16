import { Message, ChannelType } from "discord.js";
import { db } from "../db/connection.js";
import { users, conversations } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { runAgentLoop } from "../agent/loop.js";
import type { AgentContext } from "../agent/types.js";
import { decryptApiKey } from "../crypto/keys.js";
import { registerUser } from "./register.js";

export async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  const isDM = message.channel.type === ChannelType.DM;
  const isMentioned =
    message.mentions.users.has(message.client.user!.id);

  // Handle registration in DMs
  if (isDM && message.content.startsWith("!register ")) {
    await handleRegister(message);
    return;
  }

  // Handle reset command
  if (message.content.trim() === "!reset") {
    await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.discordChannelId, message.channelId),
          eq(conversations.discordUserId, message.author.id)
        )
      );
    await message.reply("Conversation reset.");
    return;
  }

  // Only respond to mentions or DMs
  if (!isDM && !isMentioned) return;

  // Check if user is registered
  const user = await db.query.users.findFirst({
    where: eq(users.discordId, message.author.id),
  });

  if (!user) {
    await message.reply(
      "You're not registered. DM me: `!register <your_torn_api_key>`"
    );
    return;
  }

  // Strip bot mention from message
  let content = message.content;
  if (isMentioned) {
    content = content.replace(/<@!?\d+>/g, "").trim();
  }
  if (!content) return;

  try {
    if ("sendTyping" in message.channel) {
      await message.channel.sendTyping();
    }

    const apiKey = decryptApiKey(user);
    const context: AgentContext = {
      tornApiKey: apiKey,
      discordUserId: message.author.id,
      discordChannelId: message.channelId,
      tornPlayerId: user.tornPlayerId ?? undefined,
      tornPlayerName: user.tornPlayerName ?? undefined,
    };

    const response = await runAgentLoop(content, context);

    // Split long messages
    const chunks = response.match(/[\s\S]{1,1900}/g) ?? [response];
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } catch (err) {
    console.error("[handler] Error:", err);
    await message.reply("An error occurred while processing your request.");
  }
}

async function handleRegister(message: Message): Promise<void> {
  const apiKey = message.content.slice("!register ".length).trim();
  if (!apiKey) {
    await message.reply("Usage: `!register <your_torn_api_key>`");
    return;
  }

  try {
    const result = await registerUser(message.author.id, apiKey);
    if (!result.success) {
      await message.reply(result.error);
    } else {
      await message.reply(
        `Registered as **${result.name}** [${result.playerId}]`
      );
    }
  } catch (err) {
    console.error("[register] Error:", err);
    await message.reply("Registration failed. Check your API key.");
  }
}
