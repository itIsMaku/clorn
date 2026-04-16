import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { encrypt } from "../crypto/keys.js";
import { tornClient } from "../torn/client.js";

interface RegisterResult {
  success: true;
  name: string;
  playerId: number;
}

interface RegisterError {
  success: false;
  error: string;
}

export async function registerUser(
  discordId: string,
  apiKey: string
): Promise<RegisterResult | RegisterError> {
  const profile = await tornClient.fetchRaw(
    `/user/?selections=basic&key=${apiKey}`
  );

  if (profile.error) {
    return { success: false, error: `Invalid API key: ${profile.error.error}` };
  }

  const encrypted = encrypt(apiKey);
  const existing = await db.query.users.findFirst({
    where: eq(users.discordId, discordId),
  });

  const data = {
    tornApiKeyEncrypted: encrypted.encrypted,
    tornApiKeyIv: encrypted.iv,
    tornApiKeyTag: encrypted.tag,
    tornPlayerId: profile.player_id,
    tornPlayerName: profile.name,
  };

  if (existing) {
    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.discordId, discordId));
  } else {
    await db.insert(users).values({ discordId, ...data });
  }

  return { success: true, name: profile.name, playerId: profile.player_id };
}
