/** Jetons de design : les couleurs pointent vers les variables CSS de src/index.css (thème « papier académique »). */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)', surface: 'var(--surface)', surface2: 'var(--surface-2)', surface3: 'var(--surface-3)',
        rule: 'var(--rule)', rule2: 'var(--rule-2)',
        ink: 'var(--ink)', ink2: 'var(--ink-2)', muted: 'var(--muted)', faint: 'var(--faint)',
        navy: 'var(--navy)', navy2: 'var(--navy-2)', navysoft: 'var(--navy-soft)',
        ok: 'var(--ok)', ko: 'var(--ko)', warn: 'var(--warn)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
}
