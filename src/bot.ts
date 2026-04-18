import { Telegraf } from 'telegraf'
import { env } from './config/env'
import { logger } from './config/logger'
import { adminService } from './modules/admin/admin.service'
import { requireRoles, withUser } from './modules/auth/auth.guard'
import { channelsService } from './modules/channels/channels.service'
import { facebookService } from './modules/integrations/facebook/facebook.service'
import { publishService } from './modules/publish/publish.service'
import { scheduleService } from './modules/schedule/schedule.service'
import { tasksService } from './modules/tasks/tasks.service'
import { AppContext, Role, Roles } from './modules/types'
import { formatDateTimeMakkah, parseDateTimeMakkah, removeCommand, splitByPipe } from './utils/commandParser'

const helpText = `🤖 Smart Telegram Agent Pro

📌 الأوامر الأساسية:
/start - عرض الرسالة الرئيسية
/help - دليل الأوامر
/me - هويتك وصلاحيتك
/tasks - آخر مهام النشر
/stats - إحصائيات المهام
/list_scheduled - المهام المجدولة
/task <id> - تفاصيل مهمة

👮 أوامر الإدارة (Owner فقط):
/add_admin <telegram_id>
/remove_admin <telegram_id>
/list_admins

📣 أوامر القنوات (Owner/Admin):
/add_channel <channel_username_or_chat_id> | <title>
/list_channels
/remove_channel <channel_id_or_username>
/set_default_channel <channel_id_or_username>

🚀 أوامر النشر (Owner/Admin/Editor):
/publish telegram | <content>
/schedule telegram | <YYYY-MM-DD HH:mm> | <content>
/publish_telegram <channel_or_default> | <content>
/schedule_telegram <YYYY-MM-DD HH:mm> | <channel_or_default> | <content>
/cancel_task <id>
/edit_task <id> | <new content>
/reschedule_task <id> | <YYYY-MM-DD HH:mm>

🕓 كل أوقات الجدولة تُفسَّر بتوقيت مكة المكرمة.

📘 Facebook (تهيئة أولية):
/add_facebook_page <page_id> | <page_name> | <optional_access_token>
/list_facebook_pages`

function requireDbUser(ctx: AppContext) {
  if (!ctx.state.dbUserId || !ctx.state.dbUserRole) {
    throw new Error('لم يتم التعرف على المستخدم.')
  }
  return {
    userId: ctx.state.dbUserId,
    role: ctx.state.dbUserRole
  }
}

export const createBot = () => {
  const bot = new Telegraf<AppContext>(env.BOT_TOKEN)
  bot.use(withUser)

  bot.start(async (ctx) => {
    await ctx.reply(`أهلًا ${ctx.from?.first_name ?? ''} 👋\n${helpText}`)
  })

  bot.help(async (ctx) => {
    await ctx.reply(helpText)
  })

  bot.command('me', async (ctx) => {
    const role = ctx.state.dbUserRole ?? 'UNKNOWN'
    await ctx.reply(`ID: ${ctx.from?.id ?? '-'}\nRole: ${role}`)
  })

  bot.command('add_admin', requireRoles(Roles.OWNER), async (ctx) => {
    const telegramId = removeCommand(ctx.message.text, 'add_admin')
    if (!telegramId) return ctx.reply('الاستخدام: /add_admin <telegram_id>')
    try {
      const user = await adminService.setRoleByTelegramId(telegramId, Roles.ADMIN)
      await ctx.reply(`✅ تم تعيين ${user.telegramId} كـ Admin.`)
    } catch {
      await ctx.reply('❌ telegram_id غير صحيح.')
    }
  })

  bot.command('remove_admin', requireRoles(Roles.OWNER), async (ctx) => {
    const telegramId = removeCommand(ctx.message.text, 'remove_admin')
    if (!telegramId) return ctx.reply('الاستخدام: /remove_admin <telegram_id>')
    try {
      const user = await adminService.setRoleByTelegramId(telegramId, Roles.VIEWER)
      await ctx.reply(`✅ تم إزالة صلاحيات الأدمن عن ${user.telegramId}.`)
    } catch {
      await ctx.reply('❌ telegram_id غير صحيح.')
    }
  })

  bot.command('list_admins', requireRoles(Roles.OWNER), async (ctx) => {
    const admins = await adminService.listAdmins()
    if (!admins.length) return ctx.reply('لا يوجد أي Admin حاليًا.')
    await ctx.reply(admins.map((a: { telegramId: string; role: Role }) => `• ${a.telegramId} (${a.role})`).join('\n'))
  })

  bot.command('add_channel', requireRoles(Roles.OWNER, Roles.ADMIN), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'add_channel'))
    if (args.length < 2) return ctx.reply('الاستخدام: /add_channel <channel_username_or_chat_id> | <title>')
    const [target, title] = args
    try {
      const channel = await channelsService.addChannel(target, title)
      await ctx.reply(`✅ تمت إضافة القناة: ${channel.title} (${channel.username ?? channel.telegramChatId})`)
    } catch (error) {
      await ctx.reply(`❌ فشل إضافة القناة: ${(error as Error).message}`)
    }
  })

  bot.command('list_channels', requireRoles(Roles.OWNER, Roles.ADMIN), async (ctx) => {
    const channels = await channelsService.listChannels()
    if (!channels.length) return ctx.reply('لا توجد قنوات مضافة.')
    const lines = channels.map(
      (c) => `• ${c.title} | ${c.username ?? c.telegramChatId} | default=${c.isDefault ? 'yes' : 'no'} | active=${c.isActive ? 'yes' : 'no'}`
    )
    await ctx.reply(lines.join('\n'))
  })

  bot.command('remove_channel', requireRoles(Roles.OWNER, Roles.ADMIN), async (ctx) => {
    const identifier = removeCommand(ctx.message.text, 'remove_channel')
    if (!identifier) return ctx.reply('الاستخدام: /remove_channel <channel_id_or_username>')
    try {
      const channel = await channelsService.removeChannel(identifier)
      if (!channel) return ctx.reply('❌ القناة غير موجودة.')
      await ctx.reply(`✅ تم حذف القناة: ${channel.title}`)
    } catch (error) {
      await ctx.reply(`❌ فشل حذف القناة: ${(error as Error).message}`)
    }
  })

  bot.command('set_default_channel', requireRoles(Roles.OWNER, Roles.ADMIN), async (ctx) => {
    const identifier = removeCommand(ctx.message.text, 'set_default_channel')
    if (!identifier) return ctx.reply('الاستخدام: /set_default_channel <channel_id_or_username>')
    const channel = await channelsService.setDefaultChannel(identifier)
    if (!channel) return ctx.reply('❌ القناة غير موجودة.')
    await ctx.reply(`✅ تم تحديد القناة الافتراضية: ${channel.title}`)
  })

  bot.command('publish_telegram', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'publish_telegram'))
    if (!args.length) return ctx.reply('الاستخدام: /publish_telegram <channel_or_default> | <content>')

    const { userId } = requireDbUser(ctx)
    const [first, second] = args
    const channel = second ? first : undefined
    const content = second ?? first

    try {
      const result = await publishService.queueTelegramPublish({
        userId,
        channelIdentifier: channel,
        content
      })
      await ctx.reply(`✅ تم وضع النشر في الطابور للقناة ${result.channel.title}. jobId=${result.job.id}`)
    } catch (error) {
      await ctx.reply(`❌ فشل النشر: ${(error as Error).message}`)
    }
  })

  bot.command('schedule_telegram', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'schedule_telegram'))
    if (args.length < 2) {
      return ctx.reply('الاستخدام: /schedule_telegram <YYYY-MM-DD HH:mm> | <channel_or_default> | <content>')
    }

    const { userId } = requireDbUser(ctx)
    const date = parseDateTimeMakkah(args[0])
    if (!date) return ctx.reply('❌ صيغة التاريخ غير صحيحة. مثال: 2026-04-18 21:30')
    if (date.getTime() <= Date.now()) return ctx.reply('❌ يجب أن يكون وقت الجدولة في المستقبل.')

    const channel = args.length === 3 ? args[1] : undefined
    const content = args.length === 3 ? args[2] : args[1]

    try {
      const result = await scheduleService.scheduleTelegram(userId, content, date, channel)
      await ctx.reply(`✅ تمت جدولة المهمة ${result.job.id} للقناة ${result.channel.title} في ${formatDateTimeMakkah(date)} بتوقيت مكة.`)
    } catch (error) {
      await ctx.reply(`❌ فشل الجدولة: ${(error as Error).message}`)
    }
  })

  bot.command('publish', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'publish'))
    if (args.length < 2) return ctx.reply('الاستخدام: /publish <platform> | <content>')

    const { userId } = requireDbUser(ctx)
    const [platform, content] = args
    switch (platform.toLowerCase()) {
      case 'telegram': {
        const result = await publishService.queueTelegramPublish({ userId, content })
        return ctx.reply(`✅ Telegram publish queued: ${result.job.id}`)
      }
      default:
        return ctx.reply('❌ المنصة غير مدعومة حاليًا. استخدم telegram.')
    }
  })

  bot.command('schedule', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'schedule'))
    if (args.length < 3) return ctx.reply('الاستخدام: /schedule <platform> | <YYYY-MM-DD HH:mm> | <content>')

    const { userId } = requireDbUser(ctx)
    const [platform, dateRaw, content] = args
    const date = parseDateTimeMakkah(dateRaw)
    if (!date) return ctx.reply('❌ صيغة التاريخ غير صحيحة.')

    switch (platform.toLowerCase()) {
      case 'telegram': {
        const result = await scheduleService.scheduleTelegram(userId, content, date)
        return ctx.reply(`✅ Telegram schedule created: ${result.job.id} at ${formatDateTimeMakkah(date)} مكة`)
      }
      default:
        return ctx.reply('❌ المنصة غير مدعومة حاليًا. استخدم telegram.')
    }
  })

  bot.command('list_scheduled', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const jobs = await tasksService.listScheduled(20)
    if (!jobs.length) return ctx.reply('لا توجد مهام مجدولة.')
    const text = jobs
      .map((j) => `• ${j.id} | ${j.platform} | ${formatDateTimeMakkah(j.scheduledFor)} | ${j.channel?.title ?? j.facebookPage?.pageName ?? '-'}`)
      .join('\n')
    await ctx.reply(text)
  })

  bot.command('task', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const taskId = removeCommand(ctx.message.text, 'task')
    if (!taskId) return ctx.reply('الاستخدام: /task <id>')
    try {
      const task = await tasksService.getTask(taskId)
      await ctx.reply(tasksService.toLine(task))
    } catch (error) {
      await ctx.reply(`❌ ${(error as Error).message}`)
    }
  })

  bot.command('cancel_task', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const taskId = removeCommand(ctx.message.text, 'cancel_task')
    if (!taskId) return ctx.reply('الاستخدام: /cancel_task <id>')
    try {
      const { userId, role } = requireDbUser(ctx)
      const task = await tasksService.cancelScheduled(taskId, userId, role)
      await ctx.reply(`✅ تم إلغاء المهمة ${task.id}`)
    } catch (error) {
      await ctx.reply(`❌ فشل الإلغاء: ${(error as Error).message}`)
    }
  })

  bot.command('edit_task', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'edit_task'))
    if (args.length < 2) return ctx.reply('الاستخدام: /edit_task <id> | <new content>')
    try {
      const { userId, role } = requireDbUser(ctx)
      const task = await tasksService.editScheduledContent(args[0], args[1], userId, role)
      await ctx.reply(`✅ تم تعديل نص المهمة ${task.id}`)
    } catch (error) {
      await ctx.reply(`❌ فشل التعديل: ${(error as Error).message}`)
    }
  })

  bot.command('reschedule_task', requireRoles(Roles.OWNER, Roles.ADMIN, Roles.EDITOR), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'reschedule_task'))
    if (args.length < 2) return ctx.reply('الاستخدام: /reschedule_task <id> | <YYYY-MM-DD HH:mm>')
    const date = parseDateTimeMakkah(args[1])
    if (!date) return ctx.reply('❌ صيغة الوقت غير صحيحة.')
    try {
      const { userId, role } = requireDbUser(ctx)
      const task = await tasksService.rescheduleTask(args[0], date, userId, role)
      await ctx.reply(`✅ تمت إعادة جدولة المهمة ${task.id} إلى ${formatDateTimeMakkah(date)} بتوقيت مكة.`)
    } catch (error) {
      await ctx.reply(`❌ فشل إعادة الجدولة: ${(error as Error).message}`)
    }
  })

  bot.command('add_facebook_page', requireRoles(Roles.OWNER, Roles.ADMIN), async (ctx) => {
    const args = splitByPipe(removeCommand(ctx.message.text, 'add_facebook_page'))
    if (args.length < 2) return ctx.reply('الاستخدام: /add_facebook_page <page_id> | <page_name> | <optional_access_token>')
    const [pageId, pageName, token] = args
    const page = await facebookService.addPage(pageId, pageName, token)
    await ctx.reply(`✅ تم حفظ صفحة Facebook: ${page.pageName} (${page.pageId}).`)
  })

  bot.command('list_facebook_pages', requireRoles(Roles.OWNER, Roles.ADMIN), async (ctx) => {
    const pages = await facebookService.listPages()
    if (!pages.length) return ctx.reply('لا توجد صفحات Facebook محفوظة.')
    await ctx.reply(pages.map((p) => `• ${p.pageName} (${p.pageId}) | token=${p.accessToken ? 'configured' : 'missing'}`).join('\n'))
  })

  bot.command('tasks', async (ctx) => {
    const jobs = await tasksService.latest(10)
    if (!jobs.length) return ctx.reply('لا توجد مهام بعد.')
    await ctx.reply(
      jobs
        .map((j) => `• ${j.id} | ${j.platform} | ${j.status} | ${j.channel?.title ?? j.facebookPage?.pageName ?? '-'}`)
        .join('\n')
    )
  })

  bot.command('stats', async (ctx) => {
    const stats = await tasksService.stats()
    const text = stats.length ? stats.map((s) => `• ${s.status}: ${s.count}`).join('\n') : 'No publish jobs yet.'
    await ctx.reply(text)
  })

  bot.catch(async (error, ctx) => {
    logger.error('Bot error', error)
    await ctx.reply('❌ حدث خطأ غير متوقع أثناء تنفيذ الأمر.')
  })

  return bot
}
