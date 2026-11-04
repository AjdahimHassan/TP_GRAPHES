/** Jetons de design (voir src/theme/tokens.ts) */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#070B16', s1: '#0E1527', s2: '#131C33', s3: '#18233F', bd: '#1E2A47', bd2: '#2A3A60',
        tx: '#E7ECF5', mu: '#8592AE', mu2: '#5D6A88',
        red: '#FF5468', amb: '#FFB547', cy: '#2EE6D6', ok: '#3DDC97', ko: '#FF4D4D', info: '#7C8CFF',
        hop: '#FF5468', cas: '#FF9F43', eco: '#FFD166', tel: '#A78BFA', qua: '#5B6B8F',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
}
