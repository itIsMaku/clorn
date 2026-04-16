import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encrypt(plaintext: string): EncryptedData {
  const key = Buffer.from(config.ENCRYPTION_KEY, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decrypt(data: EncryptedData): string {
  const key = Buffer.from(config.ENCRYPTION_KEY, "hex");
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(data.tag, "hex"));

  let decrypted = decipher.update(data.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function decryptApiKey(user: {
  tornApiKeyEncrypted: string;
  tornApiKeyIv: string;
  tornApiKeyTag: string;
}): string {
  return decrypt({
    encrypted: user.tornApiKeyEncrypted,
    iv: user.tornApiKeyIv,
    tag: user.tornApiKeyTag,
  });
}
