import { prisma } from '../../lib/prisma'
import { enqueuePublishJob, removeScheduledPublishJob } from '../../lib/queues'
import { formatDateTimeMakkah } from '../../utils/commandParser'
import { PublishStatuses, Role, Roles } from '../types'

function canManageTask(actorUserId: string, actorRole: Role, taskOwnerUserId: string) {
  if (actorRole === Roles.OWNER || actorRole === Roles.ADMIN) return true
  return actorUserId === taskOwnerUserId
}

export class TasksService {
  async latest(limit = 10) {
    return prisma.publishJob.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        channel: true,
        facebookPage: true,
        user: true
      }
    })
  }

  async stats() {
    const grouped = await prisma.publishJob.groupBy({
      by: ['status'],
      _count: { _all: true }
    })

    return grouped.map((item) => ({
      status: item.status,
      count: item._count._all
    }))
  }

  async getTask(taskId: string) {
    const task = await prisma.publishJob.findUnique({
      where: { id: taskId },
      include: { channel: true, facebookPage: true, user: true }
    })
    if (!task) throw new Error('المهمة غير موجودة.')
    return task
  }

  async listScheduled(limit = 20) {
    return prisma.publishJob.findMany({
      where: { status: PublishStatuses.SCHEDULED },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      include: { channel: true, facebookPage: true, user: true }
    })
  }

  async cancelScheduled(taskId: string, actorUserId: string, actorRole: Role) {
    const task = await this.getTask(taskId)
    if (!canManageTask(actorUserId, actorRole, task.userId)) {
      throw new Error('لا تملك صلاحية تعديل هذه المهمة.')
    }
    if (![PublishStatuses.SCHEDULED, PublishStatuses.QUEUED].includes(task.status as any)) {
      throw new Error('لا يمكن إلغاء هذه المهمة بعد الآن.')
    }

    await removeScheduledPublishJob(taskId)
    return prisma.publishJob.update({
      where: { id: taskId },
      data: { status: PublishStatuses.CANCELED, errorMessage: null }
    })
  }

  async editScheduledContent(taskId: string, newContent: string, actorUserId: string, actorRole: Role) {
    if (!newContent.trim()) throw new Error('النص الجديد فارغ.')
    const task = await this.getTask(taskId)
    if (!canManageTask(actorUserId, actorRole, task.userId)) {
      throw new Error('لا تملك صلاحية تعديل هذه المهمة.')
    }
    if (task.status !== PublishStatuses.SCHEDULED) {
      throw new Error('يمكن تعديل المحتوى للمهام المجدولة فقط.')
    }

    return prisma.publishJob.update({
      where: { id: taskId },
      data: { content: newContent.trim(), errorMessage: null }
    })
  }

  async rescheduleTask(taskId: string, date: Date, actorUserId: string, actorRole: Role) {
    const task = await this.getTask(taskId)
    if (!canManageTask(actorUserId, actorRole, task.userId)) {
      throw new Error('لا تملك صلاحية تعديل هذه المهمة.')
    }
    if (task.status !== PublishStatuses.SCHEDULED) {
      throw new Error('يمكن إعادة جدولة المهام المجدولة فقط.')
    }
    if (date.getTime() <= Date.now()) throw new Error('وقت الجدولة يجب أن يكون في المستقبل.')

    await removeScheduledPublishJob(taskId)
    const updated = await prisma.publishJob.update({
      where: { id: taskId },
      data: { scheduledFor: date, errorMessage: null, status: PublishStatuses.SCHEDULED }
    })

    const delay = Math.max(0, date.getTime() - Date.now())
    await enqueuePublishJob(taskId, delay)
    return updated
  }

  toLine(task: Awaited<ReturnType<TasksService['getTask']>>) {
    const target = task.channel?.title ?? task.facebookPage?.pageName ?? '-'
    const when = formatDateTimeMakkah(task.scheduledFor)
    return [
      `ID: ${task.id}`,
      `المنصة: ${task.platform}`,
      `الحالة: ${task.status}`,
      `الهدف: ${target}`,
      `وقت مكة: ${when}`,
      `النص: ${task.content}`
    ].join('\n')
  }
}

export const tasksService = new TasksService()
