import express from 'express'
import { env } from './config/env'
import { logger } from './config/logger'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'
import { createBot } from './bot'
import { healthRouter } from './routes/health'
import { publishWorker } from './modules/publish/publish.worker'

const bootstrap = async () => {
  await prisma.$queryRaw`SELECT 1`
  await redis.ping()
  logger.info('Database and Redis connections verified')

  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.use(healthRouter)

  const server = app.listen(env.port, () => {
    logger.info(`API listening on port ${env.port}`)
  })

  const bot = createBot()
  await bot.launch()
  logger.info('Telegram bot launched')

  publishWorker.on('completed', (job) => logger.info(`Publish worker completed ${job.id}`))
  publishWorker.on('failed', (job, error) => logger.error(`Publish worker failed ${job?.id}`, error.message))

  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}. shutting down...`)
    try {
      bot.stop(signal)
      await publishWorker.close()
      await prisma.$disconnect()
      await redis.quit()
    } finally {
      server.close(() => process.exit(0))
    }
  }

  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}

bootstrap().catch(async (error) => {
  logger.error('Failed to bootstrap app', error)
  try {
    await prisma.$disconnect()
  } catch {}
  try {
    await redis.quit()
  } catch {}
  process.exit(1)
})
