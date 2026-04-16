import { TornCache } from "./cache.js";

const BASE_URL = "https://api.torn.com";
const REQUEST_TIMEOUT_MS = 10_000;

class TornClient {
  private cache = new TornCache();
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute = 100;

  async fetch<T = unknown>(
    path: string,
    apiKey: string,
    selections: string,
    id?: string | number
  ): Promise<T> {
    const idPart = id ? `/${id}` : "";
    const url = `${BASE_URL}${path}${idPart}?selections=${selections}&key=${apiKey}`;
    const cacheKey = `${path}${idPart}:${selections}:${apiKey.slice(-6)}`;

    const cached = this.cache.get<T>(cacheKey);
    if (cached) return cached;

    await this.waitForRateLimit();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = (await res.json()) as T;
      this.cache.set(cacheKey, data);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchRaw(path: string): Promise<any> {
    const url = `${BASE_URL}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < 60_000
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldest = this.requestTimestamps[0]!;
      const waitMs = 60_000 - (now - oldest) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }
}

export const tornClient = new TornClient();
