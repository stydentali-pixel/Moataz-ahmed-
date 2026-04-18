import { prisma } from '../../lib/prisma'
import { Role, Roles } from '../types'

const roleWeight: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1
}

export class AdminService {
  async setRoleByTelegramId(telegramIdRaw: string, role: Role) {
    const telegramId = telegramIdRaw.trim()
    if (!/^\d+$/.test(telegramId)) {
      throw new Error('Invalid telegram id')
    }

    return prisma.user.upsert({
      where: { telegramId },
      update: { role },
      create: { telegramId, role }
    })
  }

  async listAdmins() {
    const rows = await prisma.user.findMany({
      where: { role: { in: [Roles.OWNER, Roles.ADMIN] as any } },
      orderBy: [{ createdAt: 'asc' }]
    })

    return rows.sort((a, b) => roleWeight[b.role as Role] - roleWeight[a.role as Role])
  }
}

export const adminService = new AdminService()
