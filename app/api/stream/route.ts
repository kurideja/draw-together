import { createClient } from "redis";

export const runtime = "nodejs";

export async function GET() {
  const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
  await redis.connect();

  const streamKey = "animals";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: string, id?: string) => {
        if (closed) return false;
        try {
          const message = `${id ? `id: ${id}\n` : ""}data: ${data}\n\n`;
          controller.enqueue(encoder.encode(message));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      try {
        // Send connection confirmation
        if (!send("connected")) return;

        // Send all historical messages
        const history = await redis.xRange(streamKey, "-", "+");
        
        for (const msg of history) {
          if (!send(JSON.stringify({ id: msg.id, ...msg.message }), msg.id)) {
            return;
          }
        }

        // Stream new messages in real-time
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

          for (const { messages } of results) {
            for (const msg of messages) {
              lastId = msg.id;
              if (!send(JSON.stringify({ id: msg.id, ...msg.message }), msg.id)) {
                return;
              }
            }
          }
        }
      } catch (error) {
        console.error("Stream error:", error);
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
        await redis.quit();
      }
    },

    cancel() {
      console.log("Client disconnected");
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
