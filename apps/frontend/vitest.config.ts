import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
