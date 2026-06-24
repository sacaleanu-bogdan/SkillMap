const nextJest = require('next/jest.js')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  // Default to node environment; hook tests override with @jest-environment jsdom docblock
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // UI pages and layouts — tested via E2E (out of scope for unit tests)
    '!src/app/globals.css',
    '!src/app/layout.tsx',
    '!src/app/_page.legacy.tsx',
    '!src/app/page.tsx',
    '!src/app/sign-in/page.tsx',
    '!src/app/(dashboard)/layout.tsx',
    '!src/app/(dashboard)/manage/page.tsx',
    '!src/app/(dashboard)/matrix/page.tsx',
    // React components — tested via E2E (out of scope for unit tests)
    '!src/components/**',
    // Type-only files
    '!src/types/**',
    // NextAuth catch-all route — framework glue, no business logic
    '!src/app/api/auth/**',
    // auth.ts — NextAuth config with module-level side effects; covered indirectly
    '!src/lib/auth.ts',
  ],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
}

module.exports = createJestConfig(config)
