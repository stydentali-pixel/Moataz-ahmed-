import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric env var: ${name}`)
  return parsed
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: integer('PORT', 3000),
  BOT_TOKEN: required('BOT_TOKEN'),
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: required('REDIS_URL'),
  ownerTelegramId: required('OWNER_TELEGRAM_ID'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  appTimeZone: 'Asia/Riyadh'
}
