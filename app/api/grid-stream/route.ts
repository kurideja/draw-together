import { createRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  const redis = await createRedisClient();

  const streamKey = "grid-updates";
  const gridKey = "grid-state";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      try {
        if (!send("connected")) return;

        // Send current grid state (load from Redis hash)
        const gridData = await redis.hGetAll(gridKey);
        for (const [key, color] of Object.entries(gridData)) {
          const [x, y] = key.split(",").map(Number);
          if (!send(JSON.stringify({ x, y, color }))) return;
        }

        // Stream new updates in real-time
        let lastId = "$";
        while (!closed) {
          const results = await redis.xRead(
            [{ key: streamKey, id: lastId }],
            { BLOCK: 5000 }
          );

          if (!results) {
            send("heartbeat");
            continue;
          }

          for (const result of results as Array<{ name: string; messages: Array<{ id: string; message: Record<string, string> }> }>) {
            for (const msg of result.messages) {
              lastId = msg.id;
              const { x, y, color } = msg.message as { x: string; y: string; color: string };
              if (!send(JSON.stringify({ x: Number(x), y: Number(y), color }))) {
                return;
              }
            }
          }
        }
      } catch (error) {
        console.error("Grid stream error:", error);
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
        await redis.quit();
      }
    },

    cancel() {
      console.log("Grid client disconnected");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
