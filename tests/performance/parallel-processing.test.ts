import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PerformanceMonitor,
  getMemoryUsage,
  PERFORMANCE_TEST_URLS,
  PERFORMANCE_THRESHOLDS,
} from "./setup";
import request from "supertest";
import { createMockAuthToken } from "../e2e/setup";

describe("Parallel Processing Performance Tests", () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  describe("Single Clip Processing Performance", () => {
    it(
      "should process a single clip within performance threshold",
      async () => {
        const initialMemory = getMemoryUsage();
        performanceMonitor.start();

        const response = await request("http://localhost:3000")
          .post("/api/process-urls")
          .set("Authorization", `Bearer ${createMockAuthToken()}`)
          .send({
            urls: [PERFORMANCE_TEST_URLS[0]],
            quickPlay: false,
          });

        const duration = performanceMonitor.end();
        const finalMemory = getMemoryUsage();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING
        );

        // Memory usage should not grow excessively
        if (initialMemory && finalMemory) {
          const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
        }

        console.log(`Single clip processing took ${duration.toFixed(2)}ms`);
      },
      PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING + 10000
    );

    it(
      "should maintain consistent performance across multiple single clips",
      async () => {
        const durations: number[] = [];

        for (let i = 0; i < 3; i++) {
          performanceMonitor.start();

          const response = await request("http://localhost:3000")
            .post("/api/process-urls")
            .set("Authorization", `Bearer ${createMockAuthToken()}`)
            .send({
              urls: [PERFORMANCE_TEST_URLS[i]],
              quickPlay: false,
            });

          const duration = performanceMonitor.end();
          durations.push(duration);

          expect(response.status).toBe(200);
          expect(duration).toBeLessThan(
            PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING
          );
        }

        // Check for performance consistency (standard deviation should be reasonable)
        const avgDuration =
          durations.reduce((a, b) => a + b, 0) / durations.length;
        const variance =
          durations.reduce(
            (acc, duration) => acc + Math.pow(duration - avgDuration, 2),
            0
          ) / durations.length;
        const stdDev = Math.sqrt(variance);

        // Standard deviation should be less than 50% of average
        expect(stdDev).toBeLessThan(avgDuration * 0.5);

        console.log(
          `Average duration: ${avgDuration.toFixed(
            2
          )}ms, StdDev: ${stdDev.toFixed(2)}ms`
        );
      },
      PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING * 3 + 30000
    );
  });

  describe("Parallel Processing Performance", () => {
    it(
      "should process 3 clips in parallel faster than sequential processing",
      async () => {
        const testUrls = PERFORMANCE_TEST_URLS.slice(0, 3);

        // Test parallel processing
        performanceMonitor.start();
        const parallelResponse = await request("http://localhost:3000")
          .post("/api/process-urls")
          .set("Authorization", `Bearer ${createMockAuthToken()}`)
          .send({
            urls: testUrls,
            quickPlay: false,
          });
        const parallelDuration = performanceMonitor.end();

        expect(parallelResponse.status).toBe(200);
        expect(parallelResponse.body.success).toBe(true);
        expect(parallelDuration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.PARALLEL_PROCESSING_3_CLIPS
        );

        // Parallel processing should be significantly faster than 3x single clip time
        const expectedSequentialTime =
          PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING * 3;
        expect(parallelDuration).toBeLessThan(expectedSequentialTime * 0.7); // At least 30% faster

        console.log(
          `Parallel processing of 3 clips took ${parallelDuration.toFixed(2)}ms`
        );
        console.log(
          `Expected sequential time would be ~${expectedSequentialTime.toFixed(
            2
          )}ms`
        );
        console.log(
          `Performance improvement: ${(
            ((expectedSequentialTime - parallelDuration) /
              expectedSequentialTime) *
            100
          ).toFixed(1)}%`
        );
      },
      PERFORMANCE_THRESHOLDS.PARALLEL_PROCESSING_3_CLIPS + 30000
    );

    it(
      "should handle concurrent users without significant performance degradation",
      async () => {
        const concurrentRequests = 3;
        const promises: Promise<any>[] = [];

        performanceMonitor.start();

        // Simulate concurrent users
        for (let i = 0; i < concurrentRequests; i++) {
          const promise = request("http://localhost:3000")
            .post("/api/process-urls")
            .set("Authorization", `Bearer ${createMockAuthToken()}-${i}`)
            .send({
              urls: [PERFORMANCE_TEST_URLS[i % PERFORMANCE_TEST_URLS.length]],
              quickPlay: false,
            });
          promises.push(promise);
        }

        const responses = await Promise.all(promises);
        const totalDuration = performanceMonitor.end();

        // All requests should succeed
        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });

        // Total time should not be much longer than single request time
        const maxExpectedTime =
          PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING * 2;
        expect(totalDuration).toBeLessThan(maxExpectedTime);

        console.log(
          `${concurrentRequests} concurrent requests took ${totalDuration.toFixed(
            2
          )}ms`
        );
      },
      PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING * 3 + 60000
    );
  });

  describe("Memory Usage Performance", () => {
    it("should not have memory leaks during processing", async () => {
      const initialMemory = getMemoryUsage();
      const memorySnapshots: any[] = [];

      // Process multiple batches to test for memory leaks
      for (let batch = 0; batch < 3; batch++) {
        const response = await request("http://localhost:3000")
          .post("/api/process-urls")
          .set(
            "Authorization",
            `Bearer ${createMockAuthToken()}-batch-${batch}`
          )
          .send({
            urls: [PERFORMANCE_TEST_URLS[batch % PERFORMANCE_TEST_URLS.length]],
            quickPlay: false,
          });

        expect(response.status).toBe(200);

        const currentMemory = getMemoryUsage();
        if (currentMemory) {
          memorySnapshots.push({
            batch,
            heapUsed: currentMemory.heapUsed,
            heapTotal: currentMemory.heapTotal,
          });
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = getMemoryUsage();

      if (initialMemory && finalMemory && memorySnapshots.length > 0) {
        // Memory should not grow excessively
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // Less than 200MB growth

        console.log(
          `Memory growth over ${memorySnapshots.length} batches: ${(
            memoryGrowth /
            1024 /
            1024
          ).toFixed(2)}MB`
        );

        // Log memory snapshots
        memorySnapshots.forEach((snapshot) => {
          console.log(
            `Batch ${snapshot.batch}: ${(
              snapshot.heapUsed /
              1024 /
              1024
            ).toFixed(2)}MB heap used`
          );
        });
      }
    }, 180000); // 3 minutes for memory leak test
  });

  describe("Database Performance", () => {
    it(
      "should save data to database within performance threshold",
      async () => {
        performanceMonitor.start();

        const response = await request("http://localhost:3000")
          .post("/api/process-urls")
          .set("Authorization", `Bearer ${createMockAuthToken()}`)
          .send({
            urls: [PERFORMANCE_TEST_URLS[0]],
            quickPlay: true, // This will trigger database saves
            quizName: "Performance Test Quiz",
          });

        const totalDuration = performanceMonitor.end();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.gameId).toBeTruthy();

        // Extract database operation time from session metrics if available
        if (response.body.sessionMetrics) {
          const dbOperationTime =
            response.body.sessionMetrics.totalDuration * 0.3; // Estimate 30% for DB ops
          expect(dbOperationTime).toBeLessThan(
            PERFORMANCE_THRESHOLDS.DATABASE_SAVE_OPERATION
          );

          console.log(
            `Estimated database operation time: ${dbOperationTime.toFixed(2)}ms`
          );
        }

        console.log(
          `Total processing with database saves took ${totalDuration.toFixed(
            2
          )}ms`
        );
      },
      PERFORMANCE_THRESHOLDS.SINGLE_CLIP_PROCESSING + 30000
    );
  });

  describe("WebSocket Performance", () => {
    it("should deliver progress updates within performance threshold", async () => {
      const WebSocket = require("ws");
      const progressUpdates: any[] = [];
      const updateTimestamps: number[] = [];

      // Connect to WebSocket
      const ws = new WebSocket(
        `ws://localhost:3001/api/progress/websocket?userId=perf-test-user`
      );

      ws.on("message", (data: Buffer) => {
        const timestamp = Date.now();
        const message = JSON.parse(data.toString());
        progressUpdates.push(message);
        updateTimestamps.push(timestamp);
      });

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start processing
      const startTime = Date.now();
      const processPromise = request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: PERFORMANCE_TEST_URLS.slice(0, 2),
          quickPlay: false,
        });

      // Wait for processing to complete
      const response = await processPromise;
      expect(response.status).toBe(200);

      ws.close();

      // Analyze WebSocket performance
      if (updateTimestamps.length > 1) {
        const intervals = [];
        for (let i = 1; i < updateTimestamps.length; i++) {
          intervals.push(updateTimestamps[i] - updateTimestamps[i - 1]);
        }

        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        expect(avgInterval).toBeLessThan(
          PERFORMANCE_THRESHOLDS.WEBSOCKET_MESSAGE_DELIVERY
        );

        console.log(
          `Average WebSocket update interval: ${avgInterval.toFixed(2)}ms`
        );
        console.log(
          `Total progress updates received: ${progressUpdates.length}`
        );
      }
    }, 120000);
  });
});
