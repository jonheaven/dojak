// TODO: write documentation for colors and palette in own markdown file and add links from here

const palette = {
  white: '#ffffff',
  white_muted: 'rgba(255, 255, 255, 0.5)',
  white_muted2: 'rgba(255, 255, 255, 0.2)',
  white_muted3: 'rgba(255, 255, 255, 0.8)',
  black: '#000000',
  black_muted: 'rgba(0, 0, 0, 0.5)',
  black_muted2: 'rgba(0, 0, 0, 0.)',

  dark: '#1E283C',
  grey: '#495361',
  light: '#A2A4AA',

  black_dark: '#2a2626',

  gold_dark2: '#b8860b',
  gold_dark: '#daa520',
  gold: '#ffd700',
  gold_light: '#ffed4e',

  yellow_dark: '#d5ac00',
  yellow: '#e3bb5f',
  yellow_light: '#fcd226',

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

  gold: '#eac249'
};

export const colors = Object.assign({}, palette, {
  transparent: 'rgba(0, 0, 0, 0)',

  text: '#FFFFFF',  // Primary text - white
  textWhite: '#FFD700',  // Secondary text - gold

  textDim: '#FFD700',  // Dim text - gold

  background: '#2F1B14',  // Deep gold base

  error: '#e52937',

  danger: 'rgba(245, 84, 84, 0.90)',

  card: 'rgba(47, 27, 20, 0.88)',  // Gold fog card background
  warning: palette.orange,
  primary: '#FFD700',  // Doge gold primary

  bg2: '#2a2a2a',
  bg3: '#434242',
  bg4: '#383535',
  search_bar_bg: '#1E1F24',

  border: 'rgba(255,255,255,0.04)',
  border2: 'rgba(255, 255, 255, 0.1)',

  icon_yellow: '#FFBA33',

  drc20_deploy: '#233933',
  drc20_transfer: '#375e4d',
  drc20_transfer_selected: '#ffd700',
  drc20_other: '#3e3e3e',

  value_up_color: '#4DA474',
  value_down_color: '#BF3F4D',

  ticker_color: '#eac249',
  ticker_color2: 'rgba(255, 255, 255, 0.85)',

  success: '#7BE098',

  txid_color: '#2AB2F8',

  cat20_color: '#77A1F2',

  warning_content: '#F4B62CD9',

  warning_bg: '#F4B62C59',
  line: 'rgba(255,255,255,0.15)',
  line2: 'rgba(255,255,255,0.3)'
});

export type ColorTypes = keyof typeof colors;


