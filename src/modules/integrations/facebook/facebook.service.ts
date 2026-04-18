import { prisma } from '../../../lib/prisma'

export class FacebookService {
  async addPage(pageId: string, pageName: string, accessToken?: string) {
    if (!pageId.trim() || !pageName.trim()) throw new Error('Invalid page data')

    return prisma.facebookPage.upsert({
      where: { pageId },
      update: { pageName, accessToken: accessToken ?? null, isActive: true },
      create: { pageId, pageName, accessToken: accessToken ?? null }
    })
  }

  async listPages() {
    return prisma.facebookPage.findMany({ orderBy: { createdAt: 'desc' } })
  }
}

export const facebookService = new FacebookService()
