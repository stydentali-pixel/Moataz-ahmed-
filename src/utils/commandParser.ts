const MAKKAH_UTC_OFFSET_HOURS = 3

export const splitByPipe = (text: string): string[] =>
  text
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean)

export const removeCommand = (text: string, command: string): string => {
  const prefix = `/${command}`
  if (!text.startsWith(prefix)) return text.trim()
  return text.slice(prefix.length).trim()
}

export const parseDateTimeMakkah = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - MAKKAH_UTC_OFFSET_HOURS,
    Number(minute),
    0,
    0
  )
  const date = new Date(utcMillis)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export const formatDateTimeMakkah = (date: Date | string | null | undefined): string => {
  if (!date) return '-'
  const value = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(value).replace(',', '')
}
