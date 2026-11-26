import { atom, read, update } from 'claude-code'
import type { Register, SessionMeasureInput } from 'claude-code'

import type { Snapshot } from '../types'

const snap = atom({ plugin: 'token-bar', key: 'snap' } as const, null)

const WIDTH = 20

function toSnap(u: Pick<SessionMeasureInput, 'context' | 'rateLimits' | 'cost'>): Snapshot {
  return {
    tokens: u.context.tokens ?? null,
    window: u.context.window,
    percent: u.context.percent ?? null,
    limits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed })),
    usd: u.cost?.usd ?? null,
  }
}

function k(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function limitName(kind: string): string {
  if (kind === 'five_hour') return '5ч'
  if (kind === 'seven_day') return 'неделя'
  return kind
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const u = await $.session.usage()
    await update($, snap, () => toSnap(u))
    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, snap, () => toSnap(e))
    return next(e)
  })

  on('ui.render', { component: 'BesidePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (s === null) {
      return next(e)
    }

    const percent = s.percent ?? 0
    const color = percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'green'
    const fiveHour = s.limits.find(l => l.kind === 'five_hour')
    const pct = `${percent}%`.padStart(4, ' ')
    const full = fiveHour ? `ctx ${pct} · 5ч ${`${Math.round(fiveHour.percentUsed)}%`.padStart(4, ' ')}` : null
    const short = `ctx ${pct}`
    const label = full && full.length <= e.props.maxColumns ? full : short
    if (label.length > e.props.maxColumns) {
      return next(e)
    }

    const { Text } = $.ui.resolve(e)
    return <Text color={color}>{label}</Text>
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (e.props.hasSurvey || s === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const percent = s.percent ?? 0
    const color = percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'green'
    const used = s.tokens === null ? '—' : k(s.tokens)
    const limits = s.limits
      .map(l => `${limitName(l.kind)} ${Math.round(l.percentUsed)}%`)
      .join(' · ')
    const usd = s.usd === null ? '' : ` · ~$${s.usd.toFixed(2)}`

    return (
      <Box>
        <Text dimColor>Контекст </Text>
        <Text color={color}>{bar(percent)}</Text>
        <Text dimColor>
          {` ${percent}% (${used} / ${k(s.window)})${limits ? ` · ${limits}` : ''}${usd}`}
        </Text>
      </Box>
    )
  })
}
