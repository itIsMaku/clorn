import { tornClient } from "../torn/client.js";
import type { BaldrsTarget } from "./data.js";

export interface EnrichedTarget extends BaldrsTarget {
  currentLevel?: number;
  statusState?: string;
  statusDescription?: string;
  lastAction?: string;
  fetchFailed?: boolean;
}

export async function enrichTargets(
  targets: BaldrsTarget[],
  apiKey: string
): Promise<EnrichedTarget[]> {
  return Promise.all(
    targets.map(async (t): Promise<EnrichedTarget> => {
      try {
        const data = await tornClient.fetch<Record<string, any>>(
          "/user",
          apiKey,
          "basic,profile",
          t.id
        );
        if (data.error) return { ...t, fetchFailed: true };
        return {
          ...t,
          currentLevel: data.level,
          statusState: data.status?.state,
          statusDescription: data.status?.description,
          lastAction: data.last_action?.relative,
        };
      } catch {
        return { ...t, fetchFailed: true };
      }
    })
  );
}
