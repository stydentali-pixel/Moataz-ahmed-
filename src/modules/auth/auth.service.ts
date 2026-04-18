import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { Role, Roles } from '../types'

export class AuthService {
  async ensureUser(telegramUser: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
  }) {
    const telegramId = String(telegramUser.id)
    const isOwner = telegramId === env.ownerTelegramId

    return prisma.user.upsert({
      where: { telegramId },
      update: {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        ...(isOwner ? { role: Roles.OWNER } : {})
      },
      create: {
        telegramId,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        role: isOwner ? Roles.OWNER : Roles.VIEWER
      }
    })
  }

  hasAnyRole(role: Role, allowed: Role[]) {
    return allowed.includes(role)
  }
}

export const authService = new AuthService()
