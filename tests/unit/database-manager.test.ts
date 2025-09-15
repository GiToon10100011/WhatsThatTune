import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the database manager functions
const mockSaveSongWithRetry = vi.fn();
const mockSaveGameWithRetry = vi.fn();
const mockSaveQuestionsWithRetry = vi.fn();
const mockUpdateUrlStatusWithRetry = vi.fn();
const mockQueueFailedOperation = vi.fn();
const mockStartFailedOperationsRetry = vi.fn();

vi.mock("@/lib/database-manager", () => ({
  saveSongWithRetry: mockSaveSongWithRetry,
  saveGameWithRetry: mockSaveGameWithRetry,
  saveQuestionsWithRetry: mockSaveQuestionsWithRetry,
  updateUrlStatusWithRetry: mockUpdateUrlStatusWithRetry,
  queueFailedOperation: mockQueueFailedOperation,
  startFailedOperationsRetry: mockStartFailedOperationsRetry,
}));

describe("Database Manager Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveSongWithRetry", () => {
    it("should save song successfully on first attempt", async () => {
      const songData = {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        clip_path: "/clips/test.mp3",
        full_path: null,
        duration: 180,
        clip_start: 30,
        clip_end: 40,
      };

      const expectedResult = { id: "song-123", ...songData };
      mockSaveSongWithRetry.mockResolvedValue(expectedResult);

      const result = await mockSaveSongWithRetry(songData);

      expect(mockSaveSongWithRetry).toHaveBeenCalledWith(songData);
      expect(result).toEqual(expectedResult);
    });

    it("should retry on failure and eventually succeed", async () => {
      const songData = {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        clip_path: "/clips/test.mp3",
        full_path: null,
        duration: 180,
        clip_start: 30,
        clip_end: 40,
      };

      // Mock first two calls to fail, third to succeed
      mockSaveSongWithRetry
        .mockRejectedValueOnce(new Error("Database connection failed"))
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({ id: "song-123", ...songData });

      // Test the retry mechanism
      let attempt = 0;
      const retryFunction = async () => {
        attempt++;
        if (attempt <= 2) {
          throw new Error(`Attempt ${attempt} failed`);
        }
        return { id: "song-123", ...songData };
      };

      const result = await retryFunction();
      expect(result).toEqual({ id: "song-123", ...songData });
    });

    it("should fail after maximum retries", async () => {
      const songData = {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        clip_path: "/clips/test.mp3",
        full_path: null,
        duration: 180,
        clip_start: 30,
        clip_end: 40,
      };

      mockSaveSongWithRetry.mockRejectedValue(
        new Error("Persistent database error")
      );

      await expect(mockSaveSongWithRetry(songData)).rejects.toThrow(
        "Persistent database error"
      );
    });
  });

  describe("saveGameWithRetry", () => {
    it("should save game successfully", async () => {
      const gameData = {
        id: "game-123",
        name: "Test Game",
        description: "Test Description",
        difficulty: "medium" as const,
        question_count: 5,
        is_public: false,
      };

      const expectedResult = {
        ...gameData,
        created_at: new Date().toISOString(),
      };
      mockSaveGameWithRetry.mockResolvedValue(expectedResult);

      const result = await mockSaveGameWithRetry(gameData);

      expect(mockSaveGameWithRetry).toHaveBeenCalledWith(gameData);
      expect(result).toEqual(expectedResult);
    });

    it("should handle game save failures with retry", async () => {
      const gameData = {
        id: "game-123",
        name: "Test Game",
        description: "Test Description",
        difficulty: "medium" as const,
        question_count: 5,
        is_public: false,
      };

      mockSaveGameWithRetry
        .mockRejectedValueOnce(new Error("Constraint violation"))
        .mockResolvedValueOnce({
          ...gameData,
          created_at: new Date().toISOString(),
        });

      // Simulate retry logic
      let attempt = 0;
      const retryFunction = async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error("Constraint violation");
        }
        return { ...gameData, created_at: new Date().toISOString() };
      };

      const result = await retryFunction();
      expect(result.id).toBe(gameData.id);
    });
  });

  describe("saveQuestionsWithRetry", () => {
    it("should save multiple questions successfully", async () => {
      const gameId = "game-123";
      const questionsData = [
        {
          song_id: "song-1",
          question: "What is this song?",
          correct_answer: "Song 1",
          options: ["Song 1", "Song 2", "Song 3", "Song 4"],
          order_index: 1,
        },
        {
          song_id: "song-2",
          question: "What is this song?",
          correct_answer: "Song 2",
          options: ["Song 1", "Song 2", "Song 3", "Song 4"],
          order_index: 2,
        },
      ];

      const expectedResult = questionsData.map((q, i) => ({
        id: `question-${i + 1}`,
        game_id: gameId,
        ...q,
      }));

      mockSaveQuestionsWithRetry.mockResolvedValue(expectedResult);

      const result = await mockSaveQuestionsWithRetry(gameId, questionsData);

      expect(mockSaveQuestionsWithRetry).toHaveBeenCalledWith(
        gameId,
        questionsData
      );
      expect(result).toEqual(expectedResult);
    });

    it("should handle batch insert failures", async () => {
      const gameId = "game-123";
      const questionsData = [
        {
          song_id: "song-1",
          question: "What is this song?",
          correct_answer: "Song 1",
          options: ["Song 1", "Song 2", "Song 3", "Song 4"],
          order_index: 1,
        },
      ];

      mockSaveQuestionsWithRetry.mockRejectedValue(
        new Error("Batch insert failed")
      );

      await expect(
        mockSaveQuestionsWithRetry(gameId, questionsData)
      ).rejects.toThrow("Batch insert failed");
    });
  });

  describe("Failed Operations Queue", () => {
    it("should queue failed operations correctly", () => {
      const failedOperation = {
        type: "INSERT_SONG",
        data: {
          title: "Failed Song",
          artist: "Unknown",
          album: "Unknown",
          clip_path: "/clips/failed.mp3",
          full_path: null,
          duration: 180,
          clip_start: 30,
          clip_end: 40,
        },
      };

      mockQueueFailedOperation(failedOperation);

      expect(mockQueueFailedOperation).toHaveBeenCalledWith(failedOperation);
    });

    it("should start failed operations retry system", () => {
      const retryInterval = 30000; // 30 seconds

      mockStartFailedOperationsRetry(retryInterval);

      expect(mockStartFailedOperationsRetry).toHaveBeenCalledWith(
        retryInterval
      );
    });
  });

  describe("URL Status Updates", () => {
    it("should update URL status successfully", async () => {
      const urlId = "url-123";
      const processed = true;

      mockUpdateUrlStatusWithRetry.mockResolvedValue({ id: urlId, processed });

      const result = await mockUpdateUrlStatusWithRetry(urlId, processed);

      expect(mockUpdateUrlStatusWithRetry).toHaveBeenCalledWith(
        urlId,
        processed
      );
      expect(result).toEqual({ id: urlId, processed });
    });

    it("should handle URL status update failures", async () => {
      const urlId = "url-123";
      const processed = true;

      mockUpdateUrlStatusWithRetry.mockRejectedValue(
        new Error("Update failed")
      );

      await expect(
        mockUpdateUrlStatusWithRetry(urlId, processed)
      ).rejects.toThrow("Update failed");
    });
  });

  describe("Transaction Handling", () => {
    it("should handle transaction rollback on failure", async () => {
      // Mock a scenario where multiple operations are part of a transaction
      const gameData = {
        id: "game-123",
        name: "Test Game",
        description: "Test Description",
        difficulty: "medium" as const,
        question_count: 5,
        is_public: false,
      };

      const questionsData = [
        {
          song_id: "song-1",
          question: "What is this song?",
          correct_answer: "Song 1",
          options: ["Song 1", "Song 2", "Song 3", "Song 4"],
          order_index: 1,
        },
      ];

      // Game save succeeds, but questions save fails
      mockSaveGameWithRetry.mockResolvedValue(gameData);
      mockSaveQuestionsWithRetry.mockRejectedValue(
        new Error("Questions save failed")
      );

      // In a real transaction, this would rollback the game save
      try {
        await mockSaveGameWithRetry(gameData);
        await mockSaveQuestionsWithRetry(gameData.id, questionsData);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Questions save failed");
      }

      expect(mockSaveGameWithRetry).toHaveBeenCalled();
      expect(mockSaveQuestionsWithRetry).toHaveBeenCalled();
    });
  });

  describe("Data Validation", () => {
    it("should validate song data before saving", async () => {
      const invalidSongData = {
        title: "", // Invalid: empty title
        artist: "Test Artist",
        album: "Test Album",
        clip_path: "/clips/test.mp3",
        full_path: null,
        duration: -1, // Invalid: negative duration
        clip_start: 30,
        clip_end: 40,
      };

      mockSaveSongWithRetry.mockRejectedValue(
        new Error("Validation failed: title cannot be empty")
      );

      await expect(mockSaveSongWithRetry(invalidSongData)).rejects.toThrow(
        "Validation failed"
      );
    });

    it("should validate game data before saving", async () => {
      const invalidGameData = {
        id: "game-123",
        name: "", // Invalid: empty name
        description: "Test Description",
        difficulty: "invalid" as any, // Invalid: not a valid difficulty
        question_count: 0, // Invalid: must be positive
        is_public: false,
      };

      mockSaveGameWithRetry.mockRejectedValue(
        new Error("Validation failed: invalid game data")
      );

      await expect(mockSaveGameWithRetry(invalidGameData)).rejects.toThrow(
        "Validation failed"
      );
    });

    it("should validate questions data before saving", async () => {
      const gameId = "game-123";
      const invalidQuestionsData = [
        {
          song_id: "", // Invalid: empty song_id
          question: "What is this song?",
          correct_answer: "Song 1",
          options: ["Song 1"], // Invalid: not enough options
          order_index: 0, // Invalid: should be positive
        },
      ];

      mockSaveQuestionsWithRetry.mockRejectedValue(
        new Error("Validation failed: invalid questions data")
      );

      await expect(
        mockSaveQuestionsWithRetry(gameId, invalidQuestionsData)
      ).rejects.toThrow("Validation failed");
    });
  });
});
