import { vi } from "vitest";
import fetch from "node-fetch";

// Setup for performance tests
global.fetch = fetch as any;

// Performance test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.WEBSOCKET_PORT = "3001";

// Performance monitoring utilities
export class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;
  private metrics: Record<string, number> = {};

  start() {
    this.startTime = performance.now();
  }

  end() {
    this.endTime = performance.now();
    return this.getDuration();
  }

  getDuration() {
    return this.endTime - this.startTime;
  }

  addMetric(name: string, value: number) {
    this.metrics[name] = value;
  }

  getMetrics() {
    return {
      duration: this.getDuration(),
      ...this.metrics,
    };
  }
}

// Memory usage monitoring
export const getMemoryUsage = () => {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return process.memoryUsage();
  }
  return null;
};

// Test data for performance tests
export const PERFORMANCE_TEST_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
  "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
];

export const LARGE_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy8VFVmDT5I3ZdwZj3KPiKy";

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  SINGLE_CLIP_PROCESSING: 30000, // 30 seconds
  PARALLEL_PROCESSING_3_CLIPS: 45000, // 45 seconds
  DATABASE_SAVE_OPERATION: 5000, // 5 seconds
  WEBSOCKET_MESSAGE_DELIVERY: 1000, // 1 second
  PROGRESS_UPDATE_FREQUENCY: 1000, // 1 second
};

// Mock console for performance tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
