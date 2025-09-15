import { vi } from "vitest";
import fetch from "node-fetch";

// Setup for E2E tests
global.fetch = fetch as any;

// Test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.WEBSOCKET_PORT = "3001";

// Mock console for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Test data
export const TEST_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Rick Roll (reliable test video)
  "https://www.youtube.com/watch?v=9bZkp7q19f0", // Gangnam Style (reliable test video)
];

export const TEST_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy8VFVmDT5I3ZdwZj3KPiKy";

export const TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
};

// Helper to wait for async operations
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Helper to create mock auth token
export const createMockAuthToken = () => "mock-jwt-token";
