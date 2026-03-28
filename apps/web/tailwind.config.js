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
          bg: '#0a0a0a',
          yellow: '#f4c430',
          gold: '#ffcc00',
          orange: '#ff8c42'
        }
      },
      boxShadow: {
        glow: '0 0 42px rgba(244, 196, 48, 0.24)'
      }
    }
  }
};
