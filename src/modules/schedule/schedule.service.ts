import { publishService } from '../publish/publish.service'

export class ScheduleService {
  async scheduleTelegram(userId: string, content: string, date: Date, channelIdentifier?: string) {
    return publishService.queueTelegramPublish({
      userId,
      content,
      scheduledFor: date,
      channelIdentifier
    })
  }

  async scheduleFacebook(userId: string, content: string, date: Date, pageId: string) {
    return publishService.queueFacebookPublish({
      userId,
      content,
      scheduledFor: date,
      pageId
    })
  }
}

export const scheduleService = new ScheduleService()
