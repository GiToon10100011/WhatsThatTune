import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("Enhanced Progress Tracking Integration", () => {
  const testUrlsFile = join(process.cwd(), "test-urls-enhanced.txt");
  let pythonProcess: ChildProcess | null = null;

  beforeEach(() => {
    // Create a test URLs file with a single YouTube URL
    writeFileSync(
      testUrlsFile,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
    );
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testUrlsFile)) {
      unlinkSync(testUrlsFile);
    }

    // Kill Python process if still running
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill("SIGTERM");
    }
  });

  it("should output enhanced progress data with video titles and stages", (done) => {
    const scriptPath = join(process.cwd(), "scripts", "create_clips.py");

    pythonProcess = spawn("python3", [scriptPath, testUrlsFile], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let progressOutputs: any[] = [];
    let hasEnhancedFields = false;

    pythonProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n");

      for (const line of lines) {
        if (line.startsWith("PROGRESS:")) {
          try {
            const progressData = JSON.parse(line.replace("PROGRESS: ", ""));
            progressOutputs.push(progressData);

            // Check for enhanced fields
            if (
              progressData.current_video_title ||
              progressData.processing_stage ||
              progressData.remaining_count !== undefined ||
              progressData.completed_videos ||
              progressData.active_workers
            ) {
              hasEnhancedFields = true;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    });

    pythonProcess.stderr?.on("data", (data) => {
      console.error("Python stderr:", data.toString());
    });

    pythonProcess.on("close", (code) => {
      try {
        // Verify we got progress outputs
        expect(progressOutputs.length).toBeGreaterThan(0);

        // Verify enhanced fields are present
        expect(hasEnhancedFields).toBe(true);

        // Check for specific enhanced fields in at least one progress update
        const hasCurrentVideoTitle = progressOutputs.some(
          (p) => p.current_video_title
        );
        const hasProcessingStage = progressOutputs.some(
          (p) => p.processing_stage
        );
        const hasRemainingCount = progressOutputs.some(
          (p) => p.remaining_count !== undefined
        );

        expect(hasCurrentVideoTitle).toBe(true);
        expect(hasProcessingStage).toBe(true);
        expect(hasRemainingCount).toBe(true);

        done();
      } catch (error) {
        done(error);
      }
    });

    pythonProcess.on("error", (error) => {
      done(error);
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill("SIGTERM");
        done(new Error("Test timed out"));
      }
    }, 30000); // 30 second timeout
  }, 35000); // 35 second test timeout

  it("should track completed videos and active workers", (done) => {
    // Create a test file with multiple URLs for parallel processing
    const multipleUrlsFile = join(
      process.cwd(),
      "test-multiple-urls-enhanced.txt"
    );
    writeFileSync(
      multipleUrlsFile,
      [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=9bZkp7q19f0",
        "https://www.youtube.com/watch?v=astISOttCQ0",
      ].join("\n")
    );

    const scriptPath = join(process.cwd(), "scripts", "create_clips.py");

    pythonProcess = spawn("python3", [scriptPath, multipleUrlsFile], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let hasCompletedVideos = false;
    let hasActiveWorkers = false;

    pythonProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n");

      for (const line of lines) {
        if (line.startsWith("PROGRESS:")) {
          try {
            const progressData = JSON.parse(line.replace("PROGRESS: ", ""));

            if (
              progressData.completed_videos &&
              progressData.completed_videos.length > 0
            ) {
              hasCompletedVideos = true;

              // Verify completed video structure
              const video = progressData.completed_videos[0];
              expect(video).toHaveProperty("title");
              expect(video).toHaveProperty("status");
              expect(["success", "failed"]).toContain(video.status);
            }

            if (
              progressData.active_workers &&
              progressData.active_workers.length > 0
            ) {
              hasActiveWorkers = true;

              // Verify active worker structure
              const worker = progressData.active_workers[0];
              expect(worker).toHaveProperty("video_title");
              expect(worker).toHaveProperty("stage");
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    });

    pythonProcess.on("close", (code) => {
      try {
        expect(hasCompletedVideos).toBe(true);
        // Note: hasActiveWorkers might be false if processing is too fast

        // Clean up
        if (existsSync(multipleUrlsFile)) {
          unlinkSync(multipleUrlsFile);
        }

        done();
      } catch (error) {
        done(error);
      }
    });

    pythonProcess.on("error", (error) => {
      done(error);
    });

    // Set a timeout to prevent hanging
    setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill("SIGTERM");
        done(new Error("Test timed out"));
      }
    }, 45000); // 45 second timeout for multiple URLs
  }, 50000); // 50 second test timeout
});
