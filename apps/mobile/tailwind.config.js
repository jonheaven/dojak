const uiPreset = require('../../packages/ui/tailwind.config');

module.exports = {
  presets: [uiPreset],
  content: ['./App.{js,jsx,ts,tsx}', './index.{js,jsx,ts,tsx}', './**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}']
};
