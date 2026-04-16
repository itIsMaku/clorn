import type Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/connection.js";
import { conversations } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_HISTORY_MESSAGES = 20; // keep last 20 messages to avoid huge context

export async function loadConversation(
  channelId: string,
  userId: string
): Promise<Anthropic.Messages.MessageParam[]> {
  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.discordChannelId, channelId),
      eq(conversations.discordUserId, userId)
    ),
  });

  if (!conv) return [];

  // Check if expired
  if (conv.expiresAt.getTime() < Date.now()) {
    await db
      .delete(conversations)
      .where(eq(conversations.id, conv.id));
    return [];
  }

  try {
    const messages = JSON.parse(
      conv.messagesJson
    ) as Anthropic.Messages.MessageParam[];
    // Return only the tail to keep context manageable
    return messages.slice(-MAX_HISTORY_MESSAGES);
  } catch {
    return [];
  }
}

export async function saveConversation(
  channelId: string,
  userId: string,
  messages: Anthropic.Messages.MessageParam[]
): Promise<void> {
  // Keep only recent messages
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  const json = JSON.stringify(trimmed);
  const now = new Date();
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.discordChannelId, channelId),
      eq(conversations.discordUserId, userId)
    ),
  });

  if (existing) {
    await db
      .update(conversations)
      .set({ messagesJson: json, updatedAt: now, expiresAt })
      .where(eq(conversations.id, existing.id));
  } else {
    await db.insert(conversations).values({
      discordChannelId: channelId,
      discordUserId: userId,
      messagesJson: json,
      expiresAt,
    });
  }
}
