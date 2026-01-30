"use client";

import { useEffect, useState, useRef } from "react";

type CellUpdate = {
  x: number;
  y: number;
  color: string;
};

export default function Page() {
  const [grid, setGrid] = useState<string[][]>(() =>
    Array(50).fill(null).map(() => Array(50).fill("#ffffff"))
  );
  const [myColor, setMyColor] = useState<string>("");
  const [status, setStatus] = useState<"connecting" | "open" | "error">("connecting");
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Generate color on mount
  useEffect(() => {
    const hue = Math.floor(Math.random() * 360);
    const h = hue / 360;
    const s = 0.7;
    const l = 0.6;
    
    // Convert HSL to RGB to hex
    const hslToHex = (h: number, s: number, l: number) => {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
      const g = Math.round(hue2rgb(p, q, h) * 255);
      const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    };
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyColor(hslToHex(h, s, l));
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:3001/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("error");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          // Initialize grid from server state
          setGrid((prev) => {
            const newGrid = prev.map(row => [...row]);
            for (const [key, color] of Object.entries(data.grid)) {
              const [x, y] = key.split(":").map(Number);
              if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                newGrid[y][x] = color as string;
              }
            }
            return newGrid;
          });
        } else if (data.type === "update") {
          const { x, y, color } = data as CellUpdate;
          setGrid((prev) => {
            const newGrid = prev.map(row => [...row]);
            newGrid[y][x] = color;
            return newGrid;
          });
        } else if (data.type === "reset") {
          // Clear the canvas
          setGrid(Array(50).fill(null).map(() => Array(50).fill("#ffffff")));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Draw grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellSize = 10;
    canvas.width = 50 * cellSize;
    canvas.height = 50 * cellSize;

    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    });
  }, [grid]);

  const paintCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!myColor || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Calculate relative position (0-1) then multiply by grid size
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 50);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 50);

    if (x >= 0 && x < 50 && y >= 0 && y < 50) {
      // Optimistically update local grid
      setGrid((prev) => {
        const newGrid = prev.map(row => [...row]);
        newGrid[y][x] = myColor;
        return newGrid;
      });

      // Send to server via WebSocket
      wsRef.current.send(JSON.stringify({
        type: "paint",
        x,
        y,
        color: myColor,
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsMouseDown(true);
    paintCell(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMouseDown) {
      paintCell(e);
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleReset = async () => {
    if (!confirm('Reset the entire canvas for all users?')) return;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reset" }));
      setGrid(Array(50).fill(null).map(() => Array(50).fill("#ffffff")));
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 select-none" style={{ touchAction: 'none' }}>
      <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
        <div className="flex items-center gap-4">
          <label className="text-lg">Your color:</label>
          <input
            type="color"
            value={myColor.startsWith('#') ? myColor : '#000000'}
            onChange={(e) => setMyColor(e.target.value)}
            className="w-12 h-12 cursor-pointer rounded border-2 border-gray-600"
          />
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
          >
            Reset Canvas
          </button>
        </div>

        <div className="rounded-xl shadow-2xl overflow-hidden bg-white">
          <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
              clientX: touch.clientX,
              clientY: touch.clientY,
            });
            handleMouseDown(mouseEvent as any);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
              clientX: touch.clientX,
              clientY: touch.clientY,
            });
            handleMouseMove(mouseEvent as any);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleMouseUp();
          }}
          className="cursor-crosshair touch-none block max-w-full h-auto"
          style={{
            imageRendering: "pixelated",
          }}
        />
        </div>

        <div className="text-xs text-gray-500">
          Status: <span className={status === "open" ? "text-green-400" : "text-red-400"}>{status}</span>
        </div>
      </div>
    </main>
  );
}
