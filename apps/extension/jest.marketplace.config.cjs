'use strict';

module.exports = {
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/shared/lib/marketplace-intents.test.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': '<rootDir>/config/jest/babelTransform.js'
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\](?!(@noble|@scure)[/\\\\]).+\\.(js|jsx|mjs|cjs|ts|tsx)$'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  moduleFileExtensions: ['web.js', 'js', 'web.ts', 'ts', 'web.tsx', 'tsx', 'json', 'web.jsx', 'jsx', 'node']
};
