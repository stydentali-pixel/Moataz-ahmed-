import { prisma } from '../../lib/prisma'
import { telegramAdapter } from '../integrations/telegram/telegram.adapter'

export class ChannelsService {
  private splitTarget(target: string) {
    const normalized = target.trim()
    if (!normalized) throw new Error('Channel target is required')
    if (normalized.startsWith('@')) {
      return { username: normalized, telegramChatId: null }
    }
    return { telegramChatId: normalized, username: null }
  }

  async addChannel(target: string, title: string) {
    await telegramAdapter.validateChannelAccess(target)
    const key = this.splitTarget(target)

    const existing = await prisma.channel.findFirst({
      where: {
        OR: [{ username: key.username ?? undefined }, { telegramChatId: key.telegramChatId ?? undefined }]
      }
    })

    if (existing) throw new Error('Channel already exists')

    return prisma.channel.create({
      data: { ...key, title: title.trim() }
    })
  }

  async listChannels() {
    return prisma.channel.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })
  }

  async resolveChannel(identifier?: string) {
    if (!identifier || identifier === 'default') {
      return prisma.channel.findFirst({ where: { isDefault: true, isActive: true } })
    }

    const normalized = identifier.trim()
    return prisma.channel.findFirst({
      where: {
        isActive: true,
        OR: [{ id: normalized }, { username: normalized }, { telegramChatId: normalized }]
      }
    })
  }

  async removeChannel(identifier: string) {
    const channel = await this.resolveChannel(identifier)
    if (!channel) return null
    if (channel.isDefault) throw new Error('Cannot delete default channel')
    await prisma.channel.delete({ where: { id: channel.id } })
    return channel
  }

  async setDefaultChannel(identifier: string) {
    const normalized = identifier.trim()
    const channel = await prisma.channel.findFirst({
      where: {
        OR: [{ id: normalized }, { username: normalized }, { telegramChatId: normalized }]
      }
    })
    if (!channel) return null

    await prisma.$transaction([
      prisma.channel.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      prisma.channel.update({ where: { id: channel.id }, data: { isDefault: true, isActive: true } })
    ])

    return prisma.channel.findUnique({ where: { id: channel.id } })
  }

  getTelegramTarget(channel: { username: string | null; telegramChatId: string | null }) {
    const target = channel.username ?? channel.telegramChatId
    if (!target) throw new Error('Channel has no valid telegram target')
    return target
  }
}

export const channelsService = new ChannelsService()
