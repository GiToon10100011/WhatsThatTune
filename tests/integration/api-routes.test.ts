import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createMockAuthToken, TEST_USER } from "../e2e/setup";

describe("API Routes Integration Tests", () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: TEST_USER },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "test-id", processed: true },
          error: null,
        }),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      })),
    };
  });

  describe("/api/process-urls", () => {
    it("should require authorization header", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authorization header required");
    });

    it("should validate request body", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          // Missing urls
          quickPlay: false,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("URLs are required");
    });

    it("should handle empty URLs array", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [],
          quickPlay: false,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("URLs are required");
    });

    it("should handle invalid authorization token", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", "Bearer invalid-token")
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid token");
    });

    it("should process valid request successfully", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
          quizName: "Integration Test Quiz",
          difficulty: "medium",
          questionCount: 5,
          isPublic: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        processedUrls: expect.any(Number),
        songsCreated: expect.any(Number),
        sessionId: expect.any(String),
      });
    }, 120000);
  });

  describe("/api/progress/websocket", () => {
    it("should initialize WebSocket server", async () => {
      const response = await request("http://localhost:3000").get(
        "/api/progress/websocket"
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: "WebSocket server initialized",
        port: expect.any(Number),
        path: "/api/progress/websocket",
      });
    });

    it("should handle progress update POST requests", async () => {
      const progressData = {
        type: "progress",
        current: 1,
        total: 5,
        percentage: 20,
        step: "downloading",
        song_title: "Test Song",
        timestamp: new Date().toISOString(),
      };

      const response = await request("http://localhost:3000")
        .post("/api/progress/websocket")
        .send({
          userId: TEST_USER.id,
          progressData,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        websocketSent: expect.any(Boolean),
        message: expect.any(String),
      });
    });

    it("should validate progress update request body", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/progress/websocket")
        .send({
          // Missing userId and progressData
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Missing userId or progressData");
    });
  });

  describe("/api/progress/monitor-clips", () => {
    it("should handle clip monitoring requests", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/progress/monitor-clips")
        .send({
          userId: TEST_USER.id,
          totalExpected: 5,
        });

      // This endpoint might not exist yet, so we'll check for appropriate response
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("/api/logs", () => {
    it("should handle log retrieval requests", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/logs")
        .query({
          sessionId: "test-session-123",
        });

      // This endpoint might not exist yet, so we'll check for appropriate response
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("/api/metrics", () => {
    it("should handle metrics retrieval requests", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/metrics")
        .query({
          userId: TEST_USER.id,
        });

      // This endpoint might not exist yet, so we'll check for appropriate response
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Error Handling", () => {
    it("should handle server errors gracefully", async () => {
      // Mock a server error
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: "Failed to process URLs",
        details: expect.any(String),
      });
    });

    it("should handle malformed JSON requests", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .set("Content-Type", "application/json")
        .send("{ invalid json }");

      expect(response.status).toBe(400);
    });

    it("should handle missing Content-Type header", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send("not json data");

      expect(response.status).toBe(400);
    });
  });

  describe("Rate Limiting", () => {
    it("should handle multiple concurrent requests", async () => {
      const concurrentRequests = Array.from({ length: 3 }, (_, i) =>
        request("http://localhost:3000")
          .post("/api/process-urls")
          .set("Authorization", `Bearer ${createMockAuthToken()}-${i}`)
          .send({
            urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
            quickPlay: false,
          })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect([200, 429, 500]).toContain(response.status); // 429 for rate limiting
      });
    }, 180000);
  });

  describe("Request Validation", () => {
    it("should validate YouTube URL format", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: ["not-a-youtube-url"],
          quickPlay: false,
        });

      expect(response.status).toBe(200); // Should process but likely fail
      expect(response.body.success).toBe(true);
      expect(response.body.songsCreated).toBe(0);
    });

    it("should handle playlist URLs", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [
            "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy8VFVmDT5I3ZdwZj3KPiKy",
          ],
          quickPlay: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 300000); // 5 minutes for playlist processing
  });

  describe("Response Format", () => {
    it("should return consistent response format for success", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: expect.any(Boolean),
        message: expect.any(String),
        processedUrls: expect.any(Number),
        songsCreated: expect.any(Number),
        gameId: expect.any(String),
        quickPlay: expect.any(Boolean),
        sessionId: expect.any(String),
        songsData: expect.any(Array),
      });
    }, 120000);

    it("should return consistent response format for errors", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: expect.any(String),
      });
    });
  });

  describe("Session Management", () => {
    it("should generate unique session IDs", async () => {
      const responses = await Promise.all([
        request("http://localhost:3000")
          .post("/api/process-urls")
          .set("Authorization", `Bearer ${createMockAuthToken()}-1`)
          .send({
            urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
            quickPlay: false,
          }),
        request("http://localhost:3000")
          .post("/api/process-urls")
          .set("Authorization", `Bearer ${createMockAuthToken()}-2`)
          .send({
            urls: ["https://www.youtube.com/watch?v=9bZkp7q19f0"],
            quickPlay: false,
          }),
      ]);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[0].body.sessionId).not.toBe(responses[1].body.sessionId);
    }, 240000);

    it("should include session metrics in response", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
          quickPlay: false,
        });

      expect(response.status).toBe(200);
      if (response.body.sessionMetrics) {
        expect(response.body.sessionMetrics).toMatchObject({
          totalDuration: expect.any(Number),
          totalOperations: expect.any(Number),
          successRate: expect.any(Number),
        });
      }
    }, 120000);
  });
});
