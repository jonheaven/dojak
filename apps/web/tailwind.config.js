const uiPreset = require('../../packages/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [uiPreset],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        dojak: {
          ink: '#09090b',
          paper: '#ffffff',
          muted: '#71717a',
          line: '#e4e4e7',
          gold: '#D4A017',
          'gold-hover': '#C49214'
        }
      },
      fontFamily: {
        sans: ['var(--font-dojak-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-dojak-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04)'
      }
    }
  }
};
