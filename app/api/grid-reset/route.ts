import { createRedisClient } from '@/lib/redis'

export async function POST() {
  try {
    const redis = await createRedisClient()
    
    // Delete the grid state and updates stream
    await redis.del('grid-state')
    await redis.del('grid-updates')
    
    await redis.quit()
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Reset error:', error)
    return Response.json({ error: 'Failed to reset' }, { status: 500 })
  }
}
