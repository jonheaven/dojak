// TODO: write documentation for colors and palette in own markdown file and add links from here

const palette = {
  white: '#ffffff',
  white_muted: 'rgba(255, 255, 255, 0.5)',
  white_muted2: 'rgba(255, 255, 255, 0.2)',
  white_muted3: 'rgba(255, 255, 255, 0.8)',
  black: '#000000',
  black_muted: 'rgba(0, 0, 0, 0.5)',
  black_muted2: 'rgba(0, 0, 0, 0.7)',

  dark: '#1E283C',
  grey: '#495361',
  light: '#A2A4AA',

  black_dark: '#2a2626',

  gold_dark2: '#9a6b1a',
  gold_dark: '#b87d20',
  gold: '#C9822A',
  gold_light: '#E5A03A',

  yellow_dark: '#b87d20',
  yellow: '#C9822A',
  yellow_light: '#E5A03A',

  red_dark: '#c92b40',
  red: '#ED334B',
  red_light: '#f05266',
  red_light2: '#f55454',

  blue_dark: '#1461d1',
  blue: '#1872F6',
  blue_light: '#c6dcfd',

  orange_dark: '#d9691c',
  orange: '#FF7B21',
  orange_light: '#ff8f42',
  orange_light2: '#FF7C2A',

  gold_fallback: '#eac249'
};

// Theme-aware colors
const lightThemeColors = {
  // Light theme - white background, black text
  background: '#ffffff',
  surface: '#f8f9fa',
  card: 'rgba(255, 255, 255, 0.95)',
  text: '#000000',
  textSecondary: '#495361',
  textDim: '#A2A4AA',
  border: 'rgba(0, 0, 0, 0.1)',
  border2: 'rgba(0, 0, 0, 0.05)',
  line: 'rgba(0, 0, 0, 0.1)',
  line2: 'rgba(0, 0, 0, 0.05)',

  // Primary colors - Dogecoin orange-gold
  primary: '#C9822A',
  primaryHover: '#E5A03A',

  // Success colors - Dogecoin orange-gold
  success: '#C9822A',
  successLight: '#E5A03A',

  // Error colors
  error: '#ED334B',
  danger: 'rgba(237, 51, 75, 0.9)',

  // Warning colors
  warning: palette.orange,
  warning_content: '#F4B62CD9',
  warning_bg: '#F4B62C59',

  // Value colors - Dogecoin orange-gold for positive
  value_up_color: '#C9822A',
  value_down_color: '#BF3F4D',

  // Ticker colors - Dogecoin orange-gold
  ticker_color: '#C9822A',
  ticker_color2: 'rgba(201, 130, 42, 0.85)',

  // DRC20 colors - Dogecoin orange-gold
  drc20_deploy: '#fff8dc',
  drc20_transfer: '#E5A03A',
  drc20_transfer_selected: '#C9822A',
  drc20_other: '#f5f5dc',

  // Icon colors
  icon_yellow: '#FFBA33',

  // Transaction colors
  txid_color: '#1872F6',

  // Background variations
  bg2: '#f8f9fa',
  bg3: '#e9ecef',
  bg4: '#dee2e6',
  search_bar_bg: '#f8f9fa'
};

const darkThemeColors = {
  // Dark theme - black background, white text
  background: '#000000',
  surface: '#1a1a1a',
  card: 'rgba(47, 27, 20, 0.88)',
  text: '#ffffff',
  textSecondary: '#C9822A',
  textDim: '#C9822A',
  border: 'rgba(255,255,255,0.04)',
  border2: 'rgba(255, 255, 255, 0.1)',
  line: 'rgba(255,255,255,0.15)',
  line2: 'rgba(255,255,255,0.3)',

  // Primary colors - Dogecoin orange-gold
  primary: '#C9822A',
  primaryHover: '#E5A03A',

  // Success colors - Dogecoin orange-gold
  success: '#C9822A',
  successLight: '#E5A03A',

  // Error colors
  error: '#ED334B',
  danger: 'rgba(237, 51, 75, 0.9)',

  // Warning colors
  warning: palette.orange,
  warning_content: '#F4B62CD9',
  warning_bg: '#F4B62C59',

  // Value colors - Dogecoin orange-gold for positive
  value_up_color: '#C9822A',
  value_down_color: '#BF3F4D',

  // Ticker colors - Dogecoin orange-gold
  ticker_color: '#C9822A',
  ticker_color2: 'rgba(201, 130, 42, 0.85)',

  // DRC20 colors - Dogecoin orange-gold
  drc20_deploy: '#2a2626',
  drc20_transfer: '#3a3526',
  drc20_transfer_selected: '#C9822A',
  drc20_other: '#2a2626',

  // Icon colors
  icon_yellow: '#FFBA33',

  // Transaction colors
  txid_color: '#1872F6',

  // Background variations
  bg2: '#1a1a1a',
  bg3: '#2a2626',
  bg4: '#383535',
  search_bar_bg: '#1E1F24'
};

// Function to get theme-aware colors
export const getThemeColors = (theme: 'light' | 'dark') => {
  return theme === 'light' ? lightThemeColors : darkThemeColors;
};

// Legacy colors object for backward compatibility - defaults to dark theme
export const colors = Object.assign({}, palette, {
  transparent: 'rgba(0, 0, 0, 0)',

  // Default to dark theme colors for backward compatibility
  ...darkThemeColors
});

export type ColorTypes = keyof typeof colors;
