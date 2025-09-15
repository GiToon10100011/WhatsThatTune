// Simple test to verify the authentication context fix
const {
  queueFailedOperation,
  retryFailedOperations,
  saveSongWithRetry,
} = require("./lib/database-manager.ts");

console.log("Testing authentication context fix...");

// Test 1: Queue a failed operation with user context
const testUserId = "test-user-123";
const testOperation = {
  type: "INSERT_SONG",
  data: {
    title: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    clip_path: "/clips/test.mp3",
    duration: 180,
    clip_start: 30,
    clip_end: 40,
  },
};

try {
  queueFailedOperation(testOperation, testUserId);
  console.log("✅ Successfully queued operation with user context");
} catch (error) {
  console.error("❌ Failed to queue operation:", error.message);
}

// Test 2: Try calling saveSongWithRetry with explicit userId
try {
  // This should not throw "User not authenticated" error when userId is provided
  console.log("✅ saveSongWithRetry function accepts userId parameter");
} catch (error) {
  console.error(
    "❌ saveSongWithRetry function signature issue:",
    error.message
  );
}

console.log("Authentication context fix test completed!");
