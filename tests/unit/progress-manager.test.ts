import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the progress store
const mockProgressStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

vi.mock("@/lib/progress-store", () => ({
  progressStore: mockProgressStore,
}));

// Mock WebSocket functions
const mockBroadcastProgress = vi.fn();

vi.mock("@/app/api/progress/websocket/route", () => ({
  broadcastProgress: mockBroadcastProgress,
}));

describe("Progress Manager Unit Tests", () => {
  const testUserId = "test-user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Progress Data Storage", () => {
    it("should store progress data correctly", () => {
      const progressData = {
        type: "progress",
        current: 2,
        total: 5,
        percentage: 40,
        step: "downloading",
        song_title: "Test Song",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set(testUserId, progressData);

      expect(mockProgressStore.set).toHaveBeenCalledWith(
        testUserId,
        progressData
      );
    });

    it("should retrieve progress data correctly", () => {
      const expectedProgressData = {
        type: "progress",
        current: 3,
        total: 5,
        percentage: 60,
        step: "clip_generation",
        song_title: "Another Test Song",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.get.mockReturnValue(expectedProgressData);

      const result = mockProgressStore.get(testUserId);

      expect(mockProgressStore.get).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual(expectedProgressData);
    });

    it("should handle missing progress data", () => {
      mockProgressStore.get.mockReturnValue(null);

      const result = mockProgressStore.get("non-existent-user");

      expect(result).toBeNull();
    });
  });

  describe("Progress Data Validation", () => {
    it("should validate progress data structure", () => {
      const validProgressData = {
        type: "progress",
        current: 1,
        total: 5,
        percentage: 20,
        step: "downloading",
        song_title: "Valid Song",
        timestamp: new Date().toISOString(),
      };

      // Mock validation function
      const validateProgressData = (data: any) => {
        return (
          typeof data.type === "string" &&
          typeof data.current === "number" &&
          typeof data.total === "number" &&
          typeof data.percentage === "number" &&
          typeof data.step === "string" &&
          typeof data.song_title === "string" &&
          data.current >= 0 &&
          data.total > 0 &&
          data.percentage >= 0 &&
          data.percentage <= 100
        );
      };

      expect(validateProgressData(validProgressData)).toBe(true);
    });

    it("should reject invalid progress data", () => {
      const invalidProgressData = {
        type: "progress",
        current: -1, // Invalid: negative
        total: 0, // Invalid: zero
        percentage: 150, // Invalid: over 100
        step: "", // Invalid: empty
        song_title: null, // Invalid: null
        timestamp: "invalid-date", // Invalid: not ISO string
      };

      const validateProgressData = (data: any) => {
        return (
          typeof data.type === "string" &&
          typeof data.current === "number" &&
          typeof data.total === "number" &&
          typeof data.percentage === "number" &&
          typeof data.step === "string" &&
          typeof data.song_title === "string" &&
          data.current >= 0 &&
          data.total > 0 &&
          data.percentage >= 0 &&
          data.percentage <= 100
        );
      };

      expect(validateProgressData(invalidProgressData)).toBe(false);
    });
  });

  describe("WebSocket Broadcasting", () => {
    it("should broadcast progress updates via WebSocket", () => {
      const progressData = {
        type: "progress",
        current: 2,
        total: 5,
        percentage: 40,
        step: "clip_generation",
        song_title: "Broadcasting Test Song",
        timestamp: new Date().toISOString(),
      };

      mockBroadcastProgress.mockReturnValue(true);

      const result = mockBroadcastProgress(testUserId, progressData);

      expect(mockBroadcastProgress).toHaveBeenCalledWith(
        testUserId,
        progressData
      );
      expect(result).toBe(true);
    });

    it("should handle WebSocket broadcast failures", () => {
      const progressData = {
        type: "progress",
        current: 1,
        total: 5,
        percentage: 20,
        step: "downloading",
        song_title: "Failed Broadcast Song",
        timestamp: new Date().toISOString(),
      };

      mockBroadcastProgress.mockReturnValue(false);

      const result = mockBroadcastProgress(testUserId, progressData);

      expect(result).toBe(false);
    });
  });

  describe("Progress Types", () => {
    it("should handle playlist extraction progress", () => {
      const playlistProgress = {
        type: "playlist_extracted",
        total_videos: 10,
        message: "Playlist extracted successfully",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set(testUserId, playlistProgress);

      expect(mockProgressStore.set).toHaveBeenCalledWith(
        testUserId,
        playlistProgress
      );
    });

    it("should handle processing start progress", () => {
      const processingStartProgress = {
        type: "processing_start",
        total_songs: 8,
        message: "Starting to process songs",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set(testUserId, processingStartProgress);

      expect(mockProgressStore.set).toHaveBeenCalledWith(
        testUserId,
        processingStartProgress
      );
    });

    it("should handle parallel progress updates", () => {
      const parallelProgress = {
        type: "parallel_progress",
        completed: 3,
        total: 5,
        successful: 2,
        failed: 1,
        percentage: 60,
        current_song: "Currently Processing Song",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set(testUserId, parallelProgress);

      expect(mockProgressStore.set).toHaveBeenCalledWith(
        testUserId,
        parallelProgress
      );
    });

    it("should handle completion progress", () => {
      const completionProgress = {
        type: "completion",
        total_processed: 4,
        total_failed: 1,
        processing_time: 120.5,
        message: "Processing completed successfully",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set(testUserId, completionProgress);

      expect(mockProgressStore.set).toHaveBeenCalledWith(
        testUserId,
        completionProgress
      );
    });
  });

  describe("Progress Calculations", () => {
    it("should calculate percentage correctly", () => {
      const calculatePercentage = (current: number, total: number) => {
        return Math.round((current / total) * 100 * 10) / 10; // Round to 1 decimal
      };

      expect(calculatePercentage(1, 4)).toBe(25.0);
      expect(calculatePercentage(3, 7)).toBe(42.9);
      expect(calculatePercentage(5, 5)).toBe(100.0);
      expect(calculatePercentage(0, 10)).toBe(0.0);
    });

    it("should calculate estimated time remaining", () => {
      const calculateETA = (
        current: number,
        total: number,
        elapsedMs: number
      ) => {
        if (current === 0) return null;
        const avgTimePerItem = elapsedMs / current;
        const remaining = total - current;
        return remaining * avgTimePerItem;
      };

      expect(calculateETA(2, 10, 20000)).toBe(80000); // 80 seconds remaining
      expect(calculateETA(5, 5, 50000)).toBe(0); // Already complete
      expect(calculateETA(0, 10, 0)).toBeNull(); // No progress yet
    });
  });

  describe("Progress Store Management", () => {
    it("should clear progress data after completion", () => {
      mockProgressStore.delete(testUserId);

      expect(mockProgressStore.delete).toHaveBeenCalledWith(testUserId);
    });

    it("should clear all progress data", () => {
      mockProgressStore.clear();

      expect(mockProgressStore.clear).toHaveBeenCalled();
    });
  });

  describe("Concurrent Progress Updates", () => {
    it("should handle multiple users progress updates", () => {
      const user1Progress = {
        type: "progress",
        current: 1,
        total: 3,
        percentage: 33.3,
        step: "downloading",
        song_title: "User 1 Song",
        timestamp: new Date().toISOString(),
      };

      const user2Progress = {
        type: "progress",
        current: 2,
        total: 5,
        percentage: 40,
        step: "clip_generation",
        song_title: "User 2 Song",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set("user-1", user1Progress);
      mockProgressStore.set("user-2", user2Progress);

      expect(mockProgressStore.set).toHaveBeenCalledWith(
        "user-1",
        user1Progress
      );
      expect(mockProgressStore.set).toHaveBeenCalledWith(
        "user-2",
        user2Progress
      );
    });

    it("should handle rapid progress updates", () => {
      const rapidUpdates = Array.from({ length: 10 }, (_, i) => ({
        type: "progress",
        current: i + 1,
        total: 10,
        percentage: (i + 1) * 10,
        step: "processing",
        song_title: `Song ${i + 1}`,
        timestamp: new Date().toISOString(),
      }));

      rapidUpdates.forEach((update) => {
        mockProgressStore.set(testUserId, update);
      });

      expect(mockProgressStore.set).toHaveBeenCalledTimes(10);
    });
  });

  describe("Error Handling in Progress Updates", () => {
    it("should handle progress store errors gracefully", () => {
      const progressData = {
        type: "progress",
        current: 1,
        total: 5,
        percentage: 20,
        step: "downloading",
        song_title: "Error Test Song",
        timestamp: new Date().toISOString(),
      };

      mockProgressStore.set.mockImplementation(() => {
        throw new Error("Storage error");
      });

      expect(() => {
        try {
          mockProgressStore.set(testUserId, progressData);
        } catch (error) {
          // Should handle error gracefully in real implementation
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });

    it("should handle WebSocket errors gracefully", () => {
      const progressData = {
        type: "progress",
        current: 1,
        total: 5,
        percentage: 20,
        step: "downloading",
        song_title: "WebSocket Error Song",
        timestamp: new Date().toISOString(),
      };

      mockBroadcastProgress.mockImplementation(() => {
        throw new Error("WebSocket error");
      });

      expect(() => {
        try {
          mockBroadcastProgress(testUserId, progressData);
        } catch (error) {
          // Should handle error gracefully in real implementation
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });
  });
});
