import { createClient } from "redis";

declare global {
  var __redisClient: ReturnType<typeof createClient> | undefined;
}

export function getRedis() {
  if (!global.__redisClient) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const client = createClient({ url });
    client.on("error", (e) => console.error("Redis error", e));
    global.__redisClient = client;
  }
  return global.__redisClient!;
}
