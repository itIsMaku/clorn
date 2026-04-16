import { tornClient } from "./client.js";

interface CachedPlayer {
  id: number;
  name: string;
}

// In-memory name → ID cache
const nameCache = new Map<string, number>();
const preloadedUsers = new Set<string>(); // track which users we've preloaded for

export function cachePlayer(name: string, id: number): void {
  nameCache.set(name.toLowerCase(), id);
}

export function lookupCachedName(name: string): number | undefined {
  return nameCache.get(name.toLowerCase());
}

/**
 * Preload cache with names from user's profile (spouse, faction members).
 * Called once per user session.
 */
export async function preloadForUser(
  apiKey: string,
  playerId: number
): Promise<void> {
  const key = String(playerId);
  if (preloadedUsers.has(key)) return;
  preloadedUsers.add(key);

  try {
    // Fetch v2 profile which includes spouse
    const profile = await tornClient.fetchRaw(
      `/v2/user/${playerId}?selections=profile&key=${apiKey}`
    );

    if (profile?.profile) {
      const p = profile.profile;
      if (p.name && p.id) cachePlayer(p.name, p.id);
      if (p.spouse?.name && p.spouse?.id) cachePlayer(p.spouse.name, p.spouse.id);
      if (p.faction_id) {
        // Fetch faction members
        const faction = await tornClient.fetchRaw(
          `/faction/${p.faction_id}?selections=basic&key=${apiKey}`
        );
        if (faction?.members) {
          for (const [id, member] of Object.entries(faction.members)) {
            const m = member as { name: string };
            if (m.name) cachePlayer(m.name, parseInt(id, 10));
          }
        }
      }
    }

    console.log(`[cache] Preloaded ${nameCache.size} player names`);
  } catch (err) {
    console.error("[cache] Preload error:", err);
  }
}

export async function searchPlayerByName(
  name: string,
  apiKey: string,
  userPlayerId?: number
): Promise<CachedPlayer | null> {
  // 1. Preload if we haven't yet
  if (userPlayerId) {
    await preloadForUser(apiKey, userPlayerId);
  }

  // 2. Check cache
  const cached = lookupCachedName(name);
  if (cached) return { id: cached, name };

  // 3. Fuzzy match - partial name match in cache
  const lower = name.toLowerCase();
  for (const [cachedName, id] of nameCache.entries()) {
    if (cachedName.includes(lower) || lower.includes(cachedName)) {
      return { id, name: cachedName };
    }
  }

  return null;
}

export function getCacheSize(): number {
  return nameCache.size;
}
