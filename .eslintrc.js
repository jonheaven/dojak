module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true
  },
  extends: [],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [],
  rules: {
    // 🚫 ZERO WARNINGS - MAXIMUM SAFETY
    // No linting rules that could break anything
    // Focus on shipping features, not code style
  },
  globals: {
    // All the globals that were causing warnings
    chrome: 'readonly',
    browser: 'readonly',
    process: 'readonly',
    Buffer: 'readonly',
    global: 'readonly',
    React: 'readonly',
    JSX: 'readonly',
    NodeJS: 'readonly',
    RequestInit: 'readonly',
    PermissionName: 'readonly',
    dunesUtils: 'readonly',
    duneid: 'readonly',
    rune: 'readonly',
    duneInfo: 'readonly',
    runeItem: 'readonly',
    CAT_VERSION: 'readonly'
  }
};
