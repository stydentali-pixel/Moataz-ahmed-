import { Telegram } from 'telegraf'
import { env } from '../../../config/env'
import { logger } from '../../../config/logger'

export class TelegramAdapter {
  private telegram = new Telegram(env.BOT_TOKEN)

  async validateChannelAccess(target: string) {
    try {
      await this.telegram.getChat(target)
      return true
    } catch {
      throw new Error(`Cannot access channel: ${target}. تأكد أن البوت أدمن في القناة.`)
    }
  }

  async publishText(target: string, content: string) {
    if (!content.trim()) throw new Error('Content cannot be empty')
    try {
      return await this.telegram.sendMessage(target, content, {
        disable_web_page_preview: true
      })
    } catch (error: any) {
      throw new Error(`Telegram publish failed: ${error.message}`)
    }
  }

  async notifyUser(telegramId: string, text: string) {
    try {
      await this.telegram.sendMessage(telegramId, text, { disable_web_page_preview: true })
    } catch (error) {
      logger.warn('Failed to notify user', telegramId, error)
    }
  }
}

export const telegramAdapter = new TelegramAdapter()
