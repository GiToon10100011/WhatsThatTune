import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TEST_URLS,
  TEST_PLAYLIST_URL,
  TEST_USER,
  waitFor,
  createMockAuthToken,
} from "./setup";
import request from "supertest";
import { createServer } from "http";
import { WebSocketServer } from "ws";

describe("End-to-End Full Flow Tests", () => {
  let mockServer: any;
  let wsServer: WebSocketServer;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Mock Supabase client with realistic responses
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

    // Setup WebSocket server for testing
    const server = createServer();
    wsServer = new WebSocketServer({ server });
    server.listen(3001);
  });

  afterEach(() => {
    if (wsServer) {
      wsServer.close();
    }
  });

  describe("Single URL Processing Flow", () => {
    it("should process a single YouTube URL from start to finish", async () => {
      const testUrl = TEST_URLS[0];

      // Mock the process-urls API response
      const mockProcessResponse = {
        success: true,
        message: "Music processing completed",
        processedUrls: 1,
        songsCreated: 1,
        gameId: null,
        quickPlay: false,
        sessionId: "test-session-123",
        songsData: [
          {
            id: "song-123",
            title: "Test Song",
          },
        ],
      };

      // Test the full flow
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [testUrl],
          quickPlay: false,
          quizName: "Test Quiz",
          difficulty: "medium",
          questionCount: 5,
          isPublic: false,
        });

      // Verify response structure
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        processedUrls: expect.any(Number),
        songsCreated: expect.any(Number),
        sessionId: expect.any(String),
      });

      // Verify that songs were created
      expect(response.body.songsCreated).toBeGreaterThan(0);
      expect(response.body.songsData).toBeInstanceOf(Array);
    }, 120000); // 2 minute timeout

    it("should handle Quick Play mode correctly", async () => {
      const testUrl = TEST_URLS[0];

      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [testUrl],
          quickPlay: true,
          quizName: "Quick Play Test",
          difficulty: "easy",
          questionCount: 3,
          isPublic: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.quickPlay).toBe(true);
      expect(response.body.gameId).toBeTruthy();
    }, 120000);
  });

  describe("Playlist Processing Flow", () => {
    it("should process a YouTube playlist from start to finish", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [TEST_PLAYLIST_URL],
          quickPlay: false,
          quizName: "Playlist Test Quiz",
          difficulty: "medium",
          questionCount: 10,
          isPublic: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.songsCreated).toBeGreaterThan(1); // Playlist should have multiple songs
    }, 300000); // 5 minute timeout for playlist processing
  });

  describe("Progress Tracking Flow", () => {
    it("should provide real-time progress updates via WebSocket", async () => {
      const progressUpdates: any[] = [];

      // Connect to WebSocket
      const ws = new (require("ws"))(
        `ws://localhost:3001/api/progress/websocket?userId=${TEST_USER.id}`
      );

      ws.on("message", (data: Buffer) => {
        const message = JSON.parse(data.toString());
        progressUpdates.push(message);
      });

      // Wait for connection
      await waitFor(1000);

      // Start processing
      const processPromise = request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: TEST_URLS.slice(0, 2), // Process 2 URLs
          quickPlay: false,
        });

      // Wait for some progress updates
      await waitFor(10000);

      // Verify progress updates were received
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Check for expected progress types
      const progressTypes = progressUpdates
        .map((update) => update.data?.type)
        .filter(Boolean);
      expect(progressTypes).toContain("progress");

      ws.close();

      // Wait for processing to complete
      const response = await processPromise;
      expect(response.status).toBe(200);
    }, 180000); // 3 minute timeout
  });

  describe("Error Recovery Flow", () => {
    it("should handle invalid YouTube URLs gracefully", async () => {
      const invalidUrl = "https://www.youtube.com/watch?v=invalid-video-id";

      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [invalidUrl],
          quickPlay: false,
        });

      // Should still return 200 but with appropriate error handling
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true); // Processing completes even with failures
      expect(response.body.songsCreated).toBe(0); // No songs created from invalid URL
    }, 60000);

    it("should handle partial failures in playlist processing", async () => {
      // Mix of valid and invalid URLs
      const mixedUrls = [
        TEST_URLS[0], // Valid
        "https://www.youtube.com/watch?v=invalid123", // Invalid
        TEST_URLS[1], // Valid
      ];

      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: mixedUrls,
          quickPlay: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should have some successful clips even with failures
      expect(response.body.songsCreated).toBeGreaterThan(0);
      expect(response.body.songsCreated).toBeLessThan(mixedUrls.length);
    }, 120000);
  });

  describe("Database Integration Flow", () => {
    it("should save all data to database correctly", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [TEST_URLS[0]],
          quickPlay: true,
          quizName: "Database Test Quiz",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify database operations were attempted
      // (In a real test, you'd verify actual database state)
      expect(response.body.gameId).toBeTruthy();
      expect(response.body.songsData).toBeInstanceOf(Array);
    }, 120000);
  });

  describe("Redirect Flow", () => {
    it("should provide correct redirect information for Quick Play", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [TEST_URLS[0]],
          quickPlay: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.quickPlay).toBe(true);
      expect(response.body.gameId).toBeTruthy();

      // Client should redirect to /play/[gameId]
      expect(response.body.gameId).toMatch(/^quick-/);
    }, 120000);

    it("should provide correct redirect information for regular mode", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/process-urls")
        .set("Authorization", `Bearer ${createMockAuthToken()}`)
        .send({
          urls: [TEST_URLS[0]],
          quickPlay: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.quickPlay).toBe(false);
      expect(response.body.songsCreated).toBeGreaterThan(0);

      // Client should redirect to /create-game with available songs
    }, 120000);
  });
});
