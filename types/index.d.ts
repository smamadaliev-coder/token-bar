export type Snapshot = {
  tokens: number | null
  window: number
  percent: number | null
  limits: { kind: string; percentUsed: number }[]
  usd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'token-bar': { snap: Snapshot | null }
  }
}
