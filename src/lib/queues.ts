import { Job, Queue } from 'bullmq'
import { redis } from './redis'

export const publishQueueName = 'publish-jobs'

export type PublishQueueData = {
  publishJobId: string
}

export const publishQueue = new Queue<PublishQueueData>(publishQueueName, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 50
  }
})

export async function enqueuePublishJob(publishJobId: string, delay = 0) {
  return publishQueue.add('publish', { publishJobId }, { delay, jobId: publishJobId })
}

export async function getScheduledPublishJob(publishJobId: string): Promise<Job<PublishQueueData> | undefined> {
  const job = await publishQueue.getJob(publishJobId)
  return job ?? undefined
}

export async function removeScheduledPublishJob(publishJobId: string) {
  const job = await getScheduledPublishJob(publishJobId)
  if (job) {
    await job.remove()
    return true
  }
  return false
}
