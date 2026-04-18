import { prisma } from '../../lib/prisma'
import { enqueuePublishJob } from '../../lib/queues'
import { channelsService } from '../channels/channels.service'
import { Platforms, PublishStatuses } from '../types'

export class PublishService {
  async queueTelegramPublish(params: {
    userId: string
    content: string
    channelIdentifier?: string
    scheduledFor?: Date
  }) {
    if (!params.content.trim()) {
      throw new Error('Content cannot be empty')
    }
    if (params.scheduledFor && params.scheduledFor.getTime() <= Date.now()) {
      throw new Error('وقت الجدولة يجب أن يكون في المستقبل.')
    }

    const channel = await channelsService.resolveChannel(params.channelIdentifier)
    if (!channel) {
      throw new Error('No target channel found. Add one and set default channel first.')
    }

    const status = params.scheduledFor ? PublishStatuses.SCHEDULED : PublishStatuses.QUEUED
    const job = await prisma.publishJob.create({
      data: {
        userId: params.userId,
        platform: Platforms.TELEGRAM,
        status,
        content: params.content.trim(),
        channelId: channel.id,
        scheduledFor: params.scheduledFor
      }
    })

    const delay = params.scheduledFor ? Math.max(0, params.scheduledFor.getTime() - Date.now()) : 0
    await enqueuePublishJob(job.id, delay)
    return { job, channel }
  }

  async queueFacebookPublish(params: {
    userId: string
    content: string
    pageId: string
    scheduledFor?: Date
  }) {
    if (!params.content.trim()) {
      throw new Error('Content cannot be empty')
    }
    if (params.scheduledFor && params.scheduledFor.getTime() <= Date.now()) {
      throw new Error('وقت الجدولة يجب أن يكون في المستقبل.')
    }

    const page = await prisma.facebookPage.findUnique({ where: { pageId: params.pageId } })
    if (!page || !page.isActive) throw new Error('Facebook page not found.')

    const status = params.scheduledFor ? PublishStatuses.SCHEDULED : PublishStatuses.QUEUED
    const job = await prisma.publishJob.create({
      data: {
        userId: params.userId,
        platform: Platforms.FACEBOOK,
        status,
        content: params.content.trim(),
        facebookPageId: page.id,
        scheduledFor: params.scheduledFor
      }
    })

    const delay = params.scheduledFor ? Math.max(0, params.scheduledFor.getTime() - Date.now()) : 0
    await enqueuePublishJob(job.id, delay)
    return { job, page }
  }
}

export const publishService = new PublishService()
