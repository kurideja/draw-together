import { createRedisClient } from './lib/redis'

const port = 3001

type ClientData = {
  id: string
}

const server = Bun.serve<ClientData>({
  port,
  hostname: '0.0.0.0',
  async fetch(req, server) {
    const url = new URL(req.url)
    
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: {
          id: crypto.randomUUID(),
        },
      })
      
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 500 })
      }
      
      return undefined
    }
    
    return new Response('Not found', { status: 404 })
  },
  
  websocket: {
    async open(ws) {
      console.log('Client connected:', ws.data.id)
      
      // Send current grid state
      const redis = await createRedisClient()
      const gridState = await redis.hGetAll('grid-state')
      await redis.quit()
      
      ws.send(JSON.stringify({
        type: 'init',
        grid: gridState,
      }))
      
      // Subscribe this client
      ws.subscribe('grid-updates')
    },
    
    async message(ws, message) {
      try {
        const data = JSON.parse(message.toString())
        
        if (data.type === 'paint') {
          const { x, y, color } = data
          
          // Validate
          if (
            typeof x !== 'number' || typeof y !== 'number' ||
            x < 0 || x >= 50 || y < 0 || y >= 50 ||
            typeof color !== 'string'
          ) {
            return
          }
          
          // Update Redis
          const redis = await createRedisClient()
          const key = `${x}:${y}`
          await redis.hSet('grid-state', key, color)
          await redis.xAdd('grid-updates', '*', {
            x: x.toString(),
            y: y.toString(),
            color,
          })
          await redis.quit()
          
          // Broadcast to all connected clients
          ws.publish('grid-updates', JSON.stringify({
            type: 'update',
            x,
            y,
            color,
          }))
        } else if (data.type === 'reset') {
          // Clear Redis
          const redis = await createRedisClient()
          await redis.del('grid-state')
          await redis.del('grid-updates')
          await redis.quit()
          
          // Broadcast reset to all connected clients
          ws.publish('grid-updates', JSON.stringify({
            type: 'reset',
          }))
        }
      } catch (error) {
        console.error('Message error:', error)
      }
    },
    
    close(ws) {
      console.log('Client disconnected:', ws.data.id)
      ws.unsubscribe('grid-updates')
    },
  },
})

console.log(`WebSocket server running on ws://localhost:${port}/ws`)
