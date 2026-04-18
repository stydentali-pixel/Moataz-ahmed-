import { Job, Worker } from 'bullmq'
import { publishQueueName, PublishQueueData } from '../../lib/queues'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { channelsService } from '../channels/channels.service'
import { facebookAdapter } from '../integrations/facebook/facebook.adapter'
import { telegramAdapter } from '../integrations/telegram/telegram.adapter'
import { Platforms, PublishStatuses } from '../types'
import { formatDateTimeMakkah } from '../../utils/commandParser'

const notifyCreator = async (publishJobId: string, text: string) => {
  const owner = await prisma.publishJob.findUnique({
    where: { id: publishJobId },
    include: { user: true }
  })
  if (owner?.user?.telegramId) {
    await telegramAdapter.notifyUser(owner.user.telegramId, text)
  }
}

const processJob = async (job: Job<PublishQueueData>) => {
  const record = await prisma.publishJob.findUnique({
    where: { id: job.data.publishJobId },
    include: { channel: true, facebookPage: true, user: true }
  })

  if (!record) throw new Error(`PublishJob ${job.data.publishJobId} not found`)
  if (record.status === PublishStatuses.CANCELED) return

  try {
    if (record.platform === Platforms.TELEGRAM) {
      if (!record.channel) throw new Error('Telegram channel is missing.')
      const target = channelsService.getTelegramTarget(record.channel)
      const result = await telegramAdapter.publishText(target, record.content)

      await prisma.publishJob.update({
        where: { id: record.id },
        data: {
          status: PublishStatuses.PUBLISHED,
          publishedAt: new Date(),
          externalPostId: String(result.message_id),
          errorMessage: null
        }
      })

      await notifyCreator(
        record.id,
        `✅ تم نشر المهمة بنجاح\nID: ${record.id}\nالقناة: ${record.channel.title}\nوقت مكة: ${formatDateTimeMakkah(new Date())}`
      )
      return
    }

    if (record.platform === Platforms.FACEBOOK) {
      if (!record.facebookPage) throw new Error('Facebook page is missing.')
      const result = await facebookAdapter.publishText(
        record.facebookPage.pageId,
        record.content,
        record.facebookPage.accessToken ?? undefined
      )

      await prisma.publishJob.update({
        where: { id: record.id },
        data: {
          status: PublishStatuses.PUBLISHED,
          publishedAt: new Date(),
          externalPostId: result.postId,
          errorMessage: null
        }
      })

      await notifyCreator(record.id, `✅ تم نشر مهمة Facebook بنجاح\nID: ${record.id}`)
      return
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown publish worker error'
    await prisma.publishJob.update({
      where: { id: record.id },
      data: { status: PublishStatuses.FAILED, errorMessage: message }
    })
    await notifyCreator(record.id, `❌ فشل نشر المهمة\nID: ${record.id}\nالسبب: ${message}`)
    throw error
  }
}

export const publishWorker = new Worker<PublishQueueData>(publishQueueName, processJob, {
  connection: redis,
  concurrency: 5
})
