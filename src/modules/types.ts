import type { Context } from 'telegraf'

export const Roles = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER'
} as const

export type Role = (typeof Roles)[keyof typeof Roles]

export const Platforms = {
  TELEGRAM: 'TELEGRAM',
  FACEBOOK: 'FACEBOOK'
} as const

export type Platform = (typeof Platforms)[keyof typeof Platforms]

export const PublishStatuses = {
  QUEUED: 'QUEUED',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED'
} as const

export type PublishStatus = (typeof PublishStatuses)[keyof typeof PublishStatuses]

export type AppContext = Context & {
  state: {
    dbUserRole?: Role
    dbUserId?: string
  }
}
