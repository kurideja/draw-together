'use client'

import { useEffect, useRef, useState } from 'react'

interface GridClientProps {
  myColor: string
}

export default function GridClient({ myColor }: GridClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [grid, setGrid] = useState<Record<string, string>>({})
  const [isConnected, setIsConnected] = useState(false)

  // Set up EventSource connection
  useEffect(() => {
    const eventSource = new EventSource('/api/grid-stream')

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'init') {
        setGrid(data.grid)
      } else if (data.type === 'update') {
        setGrid((prev) => ({
          ...prev,
          [data.key]: data.color,
        }))
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  // Render grid whenever it changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 500, 500)

    // Draw grid
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        const key = `${x}:${y}`
        const color = grid[key]
        if (color) {
          ctx.fillStyle = color
          ctx.fillRect(x * 5, y * 5, 5, 5)
        }
      }
    }
  }, [grid])

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / 5)
    const y = Math.floor((e.clientY - rect.top) / 5)

    // Optimistic update
    setGrid((prev) => ({
      ...prev,
      [`${x}:${y}`]: myColor,
    }))

    // Send to server
    await fetch('/api/grid-paint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, color: myColor }),
    })
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Collaborative Pixel Grid</h1>
      <div style={{ marginBottom: '10px' }}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      <div style={{ marginBottom: '10px' }}>
        Your color:{' '}
        <span
          style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            backgroundColor: myColor,
            border: '1px solid black',
            verticalAlign: 'middle',
          }}
        />
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onClick={handleCanvasClick}
        style={{ border: '1px solid black', cursor: 'crosshair' }}
      />
    </div>
  )
}
