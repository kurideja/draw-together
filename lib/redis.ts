import { createClient } from "redis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: ReturnType<typeof createClient> | null = null;

export async function getRedis() {
  if (!client) {
    client = createClient({ url });
    await client.connect();
    client.on("error", (e) => console.error("Redis error:", e));
  }
  return client;
}

// For API routes that need a fresh connection per request
export async function createRedisClient() {
  const redis = createClient({ url });
  await redis.connect();
  return redis;
}
