const uiConfig = require('../../packages/ui/tailwind.config');
const nativewindPreset = require('nativewind/preset');

module.exports = {
  ...uiConfig,
  presets: [nativewindPreset],
  content: ['./App.{js,jsx,ts,tsx}', './index.{js,jsx,ts,tsx}', './**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}']
};
