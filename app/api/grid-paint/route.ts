import { createRedisClient } from "@/lib/redis";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { x, y, color } = await req.json();

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof color !== "string" ||
      x < 0 || x >= 100 ||
      y < 0 || y >= 100
    ) {
      return Response.json({ error: "Invalid coordinates or color" }, { status: 400 });
    }

    const redis = await createRedisClient();

    const streamKey = "grid-updates";
    const gridKey = "grid-state";

    // Update grid state in Redis hash
    await redis.hSet(gridKey, `${x},${y}`, color);

    // Broadcast update to all clients via stream
    await redis.xAdd(streamKey, "*", { x: String(x), y: String(y), color });

    await redis.quit();

    return Response.json({ success: true });
  } catch (error) {
    console.error("Paint error:", error);
    return Response.json({ error: "Failed to paint" }, { status: 500 });
  }
}
