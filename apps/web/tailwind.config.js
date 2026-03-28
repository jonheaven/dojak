const uiPreset = require('../../packages/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [uiPreset],
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'],
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
      backgroundImage: {
        'hero-radial':
          'radial-gradient(circle at 10% 20%, rgba(244,196,48,0.22) 0%, rgba(255,140,66,0.08) 32%, rgba(10,10,10,0.97) 70%)'
      },
      boxShadow: {
        glow: '0 0 42px rgba(244, 196, 48, 0.24)'
      }
    }
  }
};
