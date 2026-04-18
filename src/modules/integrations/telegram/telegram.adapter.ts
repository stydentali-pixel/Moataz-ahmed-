import { Telegram } from "telegraf";
import { env } from "../../../config/env";

export class TelegramAdapter {
  private telegram = new Telegram(env.BOT_TOKEN);

  async validateChannelAccess(target: string) {
    try {
      const chat = await this.telegram.getChat(target);
      if (!chat) {
        throw new Error("Channel not found");
      }
      return true;
    } catch {
      throw new Error(`Cannot access channel: ${target}`);
    }
  }

  async publishText(target: string, content: string) {
    if (!content.trim()) {
      throw new Error("Content cannot be empty");
    }

    try {
      return await this.telegram.sendMessage(target, content, {
        link_preview_options: {
          is_disabled: true,
        },
      });
    } catch (error: any) {
      throw new Error(`Telegram publish failed: ${error.message}`);
    }
  }

  async notifyUser(userId: string | number, message: string) {
    return this.telegram.sendMessage(userId, message, {
      link_preview_options: {
        is_disabled: true,
      },
    });
  }
}

export const telegramAdapter = new TelegramAdapter();
