import { MiddlewareFn } from 'telegraf'
import { authService } from './auth.service'
import { AppContext, Role } from '../types'
import { logger } from '../../config/logger'

export const withUser: MiddlewareFn<AppContext> = async (ctx, next) => {
  if (!ctx.from) return next()

  try {
    const user = await authService.ensureUser(ctx.from)
    ctx.state.dbUserRole = user.role as Role
    ctx.state.dbUserId = user.id
  } catch (error) {
    logger.error('Failed to load bot user', error)
    await ctx.reply('❌ تعذر تحميل بيانات المستخدم. حاول مرة أخرى.')
    return
  }

  await next()
}

export const requireRoles =
  (...roles: Role[]): MiddlewareFn<AppContext> =>
  async (ctx, next) => {
    const role = ctx.state.dbUserRole
    if (!role || !authService.hasAnyRole(role, roles)) {
      await ctx.reply('❌ ليس لديك صلاحية. تواصل مع المسؤول.')
      return
    }
    await next()
  }
