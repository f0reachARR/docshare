import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
  },
});
