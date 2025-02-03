import { fetchJMAData } from '../utils/jma'
import { EARTHQUAKE_CACHE_TTL } from '../constants'

export default {
  async scheduled(_event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const earthquakeData = await fetchJMAData()
          await env.JMA_DATA.put('earthquakes:latest', JSON.stringify(earthquakeData), {
            expirationTtl: EARTHQUAKE_CACHE_TTL,
          })
        } catch (error) {
          console.error('Error updating earthquake data in cron job:', error)
          throw error
        }
      })()
    )
  },
}
