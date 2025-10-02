// Global test setup file for Vitest
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(() => {
  // Global setup before all tests

  // Use current working directory for config in tests
  // This allows memfs mocking to work correctly
  process.env.ACTUAL_MONZO_CONFIG_DIR = process.cwd();
});

afterAll(() => {
  // Global cleanup after all tests
});

afterEach(() => {
  // Reset mocks after each test
  // vi.restoreAllMocks();
});
