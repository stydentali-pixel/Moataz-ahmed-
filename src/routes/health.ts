import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'

export const healthRouter = Router()

healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    await redis.ping()
    res.json({ ok: true, service: 'smart-telegram-agent', db: 'up', redis: 'up' })
  } catch (error) {
    res.status(500).json({ ok: false, service: 'smart-telegram-agent', db: 'down', redis: 'down' })
  }
})
