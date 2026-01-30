"use client";

import { useEffect, useState } from "react";

type AnimalMsg = { id: string; name?: string };

export default function Page() {
  const [items, setItems] = useState<AnimalMsg[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "error">("connecting");

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus("error");

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as AnimalMsg;
        if (msg.id && msg.name) {
          setItems((prev) => [msg, ...prev].slice(0, 50));
        }
      } catch {
        // Ignore non-JSON messages (connected, heartbeat)
      }
    };

    return () => es.close();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Animals live stream</h1>
      <p>Status: {status}</p>

      <ul>
        {items.map((x) => (
          <li key={x.id}>
            <code>{x.id}</code> — <b>{x.name ?? "(no name)"}</b>
          </li>
        ))}
      </ul>
    </main>
  );
}
