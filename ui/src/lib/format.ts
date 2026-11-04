import type { Num } from './types'

/** Nombre au format français ; les infinis restent des infinis (jamais un grand nombre fini). */
export function fmt(x: Num | undefined, d = 1): string {
  if (x === null || x === undefined) return '—'
  if (x === '+inf') return '+∞'
  if (x === '-inf') return '−∞'
  if (typeof x !== 'number' || Number.isNaN(x)) return '—'
  return x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export const fmtInt = (x: number | null | undefined) => (x === null || x === undefined ? '—' : x.toLocaleString('fr-FR'))

export const fmtMs = (x: number | null | undefined) => {
  if (x === null || x === undefined) return '—'
  if (x >= 1000) return `${fmt(x / 1000, 2)} s`
  return `${fmt(x, x < 1 ? 3 : x < 10 ? 2 : 1)} ms`
}

export const isFinite_ = (x: Num | undefined): x is number => typeof x === 'number'

export const shortHash = (h?: string | null) => (h ? `${h.slice(0, 4)}…${h.slice(-4)}` : '—')

export const signed = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : '+'}${fmt(Math.abs(x), d)}`)

export const bytes = (n: number) => (n > 1024 * 1024 ? `${fmt(n / 1048576, 1)} Mo` : n > 1024 ? `${fmt(n / 1024, 1)} Ko` : `${n} o`)

export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* presse-papiers indisponible */ }
}
