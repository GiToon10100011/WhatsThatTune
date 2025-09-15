import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createClient } from "@supabase/supabase-js";
import {
  saveSongWithRetry,
  saveGameWithRetry,
  saveQuestionsWithRetry,
  updateUrlStatusWithRetry,
  queueFailedOperation,
  startFailedOperationsRetry,
} from "@/lib/database-manager";
import {
  startSession,
  endSession,
  logProcessingStep,
  logEnhancedDatabaseOperation,
  startPerformanceTimer,
  endPerformanceTimer,
} from "@/lib/server-logger";

const execAsync = promisify(exec);

function isPlaylistUrl(url: string): boolean {
  return url.includes("playlist?list=") || url.includes("/playlist/");
}

function extractPlaylistId(url: string): string | null {
  const playlistMatch = url.match(/[?&]list=([^&]+)/);
  return playlistMatch ? playlistMatch[1] : null;
}

export async function POST(request: NextRequest) {
  const sessionId = `session_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  let userId: string | undefined;

  try {
    // Authorization 헤더에서 토큰 추출
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authorization.replace("Bearer ", "");

    // 서버 사이드 Supabase 클라이언트 생성 (service role key 사용)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 토큰으로 사용자 검증
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    userId = user.id;

    // 세션 시작 로깅
    startSession(sessionId, userId);

    const {
      urls,
      quickPlay,
      quizName,
      difficulty,
      questionCount,
      isPublic,
      forceReprocess = false,
    } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs are required" }, { status: 400 });
    }

    // 플레이리스트 URL 중복 검사
    for (const url of urls) {
      if (isPlaylistUrl(url)) {
        const playlistId = extractPlaylistId(url);
        if (playlistId) {
          // 기존에 같은 플레이리스트를 처리한 적이 있는지 확인
          const { data: existingUrls, error } = await supabase
            .from("youtube_urls")
            .select("*")
            .eq("url", url.trim())
            .eq("created_by", user.id)
            .eq("processed", true)
            .limit(1);

          if (!error && existingUrls && existingUrls.length > 0) {
            if (!forceReprocess && !quickPlay) {
              // Quick Play 모드가 아닌 경우에만 중복 검사 적용
              // 관련 게임들을 가져와서 미리보기로 제공
              const { data: games } = await supabase
                .from("games")
                .select("id, name, description, created_at, question_count")
                .eq("created_by", user.id)
                .order("created_at", { ascending: false })
                .limit(5);

              return NextResponse.json(
                {
                  duplicate: true,
                  playlistUrl: url,
                  message:
                    "이미 처리된 플레이리스트입니다. 기존 게임을 확인하시거나 재처리를 선택하세요.",
                  existingGames: games || [],
                  playlistId,
                },
                { status: 409 }
              );
            } else {
              // 강제 재처리 - 기존 데이터 삭제
              const { data: songsToDelete } = await supabase
                .from("songs")
                .select("id, clip_path, full_path")
                .eq("created_by", user.id);

              // 파일 시스템에서 관련 파일들 삭제
              if (songsToDelete) {
                for (const song of songsToDelete) {
                  if (song.clip_path) {
                    try {
                      await execAsync(
                        `rm -f "${join(
                          process.cwd(),
                          "public",
                          song.clip_path
                        )}"`
                      );
                    } catch (err) {
                      console.warn(
                        `Failed to delete clip: ${song.clip_path}`,
                        err
                      );
                    }
                  }
                  if (song.full_path) {
                    try {
                      await execAsync(
                        `rm -f "${join(
                          process.cwd(),
                          "public",
                          song.full_path
                        )}"`
                      );
                    } catch (err) {
                      console.warn(
                        `Failed to delete full audio: ${song.full_path}`,
                        err
                      );
                    }
                  }
                }
              }

              // DB에서 기존 데이터 삭제
              await supabase
                .from("questions")
                .delete()
                .eq("game_id", `quick-${user.id}`);
              await supabase.from("games").delete().eq("created_by", user.id);
              await supabase.from("songs").delete().eq("created_by", user.id);
              await supabase
                .from("youtube_urls")
                .delete()
                .eq("created_by", user.id);
            }
          }
        }
      }
    }

    // YouTube URLs를 데이터베이스에 저장
    const urlRecords = [];
    for (const url of urls) {
      const { data: urlRecord, error } = await supabase
        .from("youtube_urls")
        .insert({
          url: url.trim(),
          created_by: user.id,
          processed: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving URL to database:", error);
        continue;
      }
      urlRecords.push(urlRecord);
    }

    if (urlRecords.length === 0) {
      return NextResponse.json(
        { error: "Failed to save URLs" },
        { status: 500 }
      );
    }

    // scripts 디렉토리 경로
    const scriptsDir = join(process.cwd(), "scripts");
    const urlsFilePath = join(
      scriptsDir,
      `temp_urls_${user.id}_${Date.now()}.txt`
    );

    // URLs를 임시 파일에 저장 (Python 스크립트용)
    const urlsContent = urls.join("\n");
    await writeFile(urlsFilePath, urlsContent, "utf-8");

    console.log("Starting music processing...");
    console.log("URLs:", urls);

    // Python 스크립트 실행 로깅
    const pythonExecutionTimerId = `python-execution-${sessionId}`;
    startPerformanceTimer(pythonExecutionTimerId);

    logProcessingStep(
      "Python Script Execution Start",
      "download",
      `Processing ${urls.length} URLs`,
      true,
      0,
      { urls: urls.length, quickPlay, sessionId },
      userId,
      sessionId
    );

    // Python 스크립트 실행
    // 가상환경 Python 사용 (패키지 설치됨)
    let pythonCmd = "./venv312/bin/python";

    const command = `cd ${scriptsDir} && ${pythonCmd} create_clips.py ${urlsFilePath
      .split("/")
      .pop()}`;

    console.log("Executing command:", command);

    // spawn을 사용해서 실시간 스트리밍
    const { spawn } = require("child_process");

    const processResult = await new Promise<{
      stdout: string;
      stderr: string;
      lastProgress: any;
    }>((resolve, reject) => {
      const pythonProcess = spawn(
        pythonCmd,
        ["create_clips.py", urlsFilePath.split("/").pop()],
        {
          cwd: scriptsDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";
      let lastProgress: any = null;

      pythonProcess.stdout.on("data", (data: Buffer) => {
        const output = data.toString();
        stdout += output;

        // 모든 Python 출력 로깅 (디버깅용)
        console.log(`Python stdout for user ${user.id}:`, output.trim());

        // PROGRESS: JSON 라인을 찾아서 파싱
        const lines = output.split("\n");
        for (const line of lines) {
          if (line.startsWith("PROGRESS: ")) {
            try {
              const progressJson = line.substring("PROGRESS: ".length);
              const progressData = JSON.parse(progressJson);
              lastProgress = progressData;

              // 진행률 데이터를 직접 메모리 저장소에 저장
              console.log(`Progress update for user ${user.id}:`, progressData);

              // WebSocket으로 실시간 전송 및 progressStore에 저장
              try {
                const { progressStore } = require("@/lib/progress-store");

                // 플레이리스트 추출 완료 시 총 개수 설정
                if (
                  progressData.type === "playlist_extracted" &&
                  progressData.total_videos
                ) {
                  const baseUrl =
                    process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`;
                  fetch(`${baseUrl}/api/progress/monitor-clips`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: user.id,
                      totalExpected: progressData.total_videos,
                    }),
                  })
                    .then((response) => {
                      console.log(
                        `TotalExpected set from playlist_extracted: ${progressData.total_videos} for user ${user.id}`
                      );
                      if (!response.ok) {
                        console.warn(
                          "Failed to set totalExpected from playlist_extracted:",
                          response.status
                        );
                      }
                    })
                    .catch((err) =>
                      console.warn(
                        "Failed to set totalExpected from playlist_extracted:",
                        err
                      )
                    );
                }

                // 플레이리스트 분석 완료 시 총 개수 반영 및 클립 모니터링에 전달
                if (
                  progressData.type === "processing_start" &&
                  progressData.total_songs
                ) {
                  progressData.total = progressData.total_songs;
                  progressData.current = 0;
                  progressData.percentage = 0;
                  progressData.step = "다운로드 시작 준비";
                  progressData.song_title = `총 ${progressData.total_songs}개 곡 처리를 시작합니다`;

                  // 클립 모니터링에 총 개수 전달 (절대 URL 사용)
                  const baseUrl =
                    process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`;
                  fetch(`${baseUrl}/api/progress/monitor-clips`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: user.id,
                      totalExpected: progressData.total_songs,
                    }),
                  })
                    .then((response) => {
                      console.log(
                        `TotalExpected successfully set: ${progressData.total_songs} for user ${user.id}`
                      );
                      if (!response.ok) {
                        console.warn(
                          "Failed to set totalExpected, response not ok:",
                          response.status
                        );
                      }
                    })
                    .catch((err) =>
                      console.warn(
                        "Failed to set totalExpected in clip monitoring:",
                        err
                      )
                    );
                }

                // WebSocket으로 실시간 전송
                const baseUrl =
                  process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`;
                fetch(`${baseUrl}/api/progress/websocket`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    progressData,
                  }),
                }).catch((err) =>
                  console.warn("Failed to send progress via WebSocket:", err)
                );

                // 폴백용으로 progressStore에도 저장
                progressStore.set(user.id, progressData);
                console.log(
                  `Progress sent via WebSocket and stored for user ${user.id}`,
                  progressData.type
                );
              } catch (err) {
                console.warn("Failed to process progress data:", err);
              }
            } catch (e) {
              console.warn("Failed to parse progress JSON:", line);
            }
          }
        }
      });

      pythonProcess.stderr.on("data", (data: Buffer) => {
        const errorOutput = data.toString();
        stderr += errorOutput;
        console.log(`Python stderr for user ${user.id}:`, errorOutput.trim());
      });

      pythonProcess.on("close", (code) => {
        console.log(`Python process finished with code: ${code}`);
        console.log("Final stdout:", stdout.slice(-500)); // 마지막 500자
        console.log("Final stderr:", stderr.slice(-500));

        if (code === 0) {
          resolve({ stdout, stderr, lastProgress });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on("error", (error) => {
        reject(error);
      });

      // 타임아웃 설정
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error("Process timeout"));
      }, 1800000); // 30분
    });

    const { stdout, stderr } = processResult;

    // Python 스크립트 실행 완료 로깅
    const pythonExecutionDuration = endPerformanceTimer(
      pythonExecutionTimerId,
      "python-execution",
      "Python Script Execution",
      !stderr,
      { hasErrors: !!stderr },
      userId,
      sessionId
    );

    logProcessingStep(
      "Python Script Execution Complete",
      "download",
      `Processed ${urls.length} URLs`,
      !stderr,
      pythonExecutionDuration,
      {
        urls: urls.length,
        quickPlay,
        sessionId,
        hasStdout: !!stdout,
        hasStderr: !!stderr,
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
      },
      userId,
      sessionId
    );

    console.log("Process output:", stdout);
    if (stderr) {
      console.error("Process errors:", stderr);
    }

    // 임시 파일 삭제
    try {
      await execAsync(`rm ${urlsFilePath}`);
    } catch (err) {
      console.warn("Failed to delete temp file:", err);
    }

    // 처리 완료 후 데이터베이스 상태 업데이트 (재시도 포함)
    console.log("Updating URL statuses with retry mechanism...");
    for (const record of urlRecords) {
      try {
        await updateUrlStatusWithRetry(record.id, true, supabase); // 서비스 역할 키 클라이언트 전달
        console.log(`Successfully updated URL status: ${record.id}`);
      } catch (error) {
        console.error(`Failed to update URL status ${record.id}:`, error);
        // 실패한 작업을 큐에 추가
        queueFailedOperation(
          {
            type: "UPDATE_URL_STATUS",
            data: { id: record.id, processed: true },
          },
          userId!,
          sessionId
        );
      }
    }

    // Python 스크립트 실행 후 생성된 클립들을 데이터베이스에 저장
    let gameId: string | null = null;
    let songsData = [];

    console.log("Starting to process clip files...");

    // 클립 파일 처리 시작 로깅
    const clipProcessingTimerId = `clip-processing-${sessionId}`;
    startPerformanceTimer(clipProcessingTimerId);

    logProcessingStep(
      "Clip File Processing Start",
      "database_save",
      "Processing generated clips",
      true,
      0,
      { sessionId },
      userId,
      sessionId
    );

    try {
      // 생성된 클립 파일들 찾기
      const { readdir } = require("fs").promises;
      const clipsPath = join(process.cwd(), "public", "clips");
      const clipFiles = await readdir(clipsPath).catch(() => []);

      console.log(
        `Found ${clipFiles.length} files in clips directory:`,
        clipFiles.filter((f) => f.endsWith(".mp3")).slice(0, 5)
      );

      // 최근 생성된 클립 파일들 처리 (시간 범위 확대)
      for (const clipFile of clipFiles) {
        if (clipFile.endsWith(".mp3")) {
          const clipPath = join(clipsPath, clipFile);
          const stats = await require("fs").promises.stat(clipPath);

          // 최근 30분 내에 생성된 파일만 처리 (시간 단위 확대)
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          if (stats.mtime > thirtyMinutesAgo) {
            // 원본 YouTube 제목 사용 (파일명 그대로)
            const baseName = clipFile
              .replace("_clip.mp3", "")
              .replace(/_/g, " ");
            const title = baseName; // 원본 YouTube 제목 그대로 사용

            // 데이터베이스에 노래 정보 저장
            const songId = `song_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;

            console.log("Attempting to save song to DB:", {
              title,
              userId: user.id,
              clipFile,
            });

            // 안정성이 강화된 노래 저장
            try {
              const songSaveTimerId = `song-save-${clipFile}-${sessionId}`;
              startPerformanceTimer(songSaveTimerId);

              const songData = await saveSongWithRetry(
                {
                  title: title, // 원본 YouTube 제목
                  artist: "Unknown",
                  album: "Unknown",
                  clip_path: `/clips/${clipFile}`,
                  full_path: null, // 클린업된 경우 null
                  duration: 180, // 기본값 3초
                  clip_start: 30,
                  clip_end: 40,
                },
                userId,
                supabase // 서비스 역할 키 클라이언트 전달
              );

              const songSaveDuration = endPerformanceTimer(
                songSaveTimerId,
                "database",
                "Save Song",
                true,
                { title, clipFile },
                userId,
                sessionId
              );

              logProcessingStep(
                "Song Database Save",
                "database_save",
                title,
                true,
                songSaveDuration,
                { clipFile, songId: songData.id },
                userId,
                sessionId
              );

              songsData.push(songData);
              console.log("Song saved to DB with retry:", songData.title);
            } catch (songError) {
              const songSaveDuration = endPerformanceTimer(
                `song-save-${clipFile}-${sessionId}`,
                "database",
                "Save Song",
                false,
                {
                  title,
                  clipFile,
                  error:
                    songError instanceof Error
                      ? songError.message
                      : String(songError),
                },
                userId,
                sessionId
              );

              logProcessingStep(
                "Song Database Save",
                "database_save",
                title,
                false,
                songSaveDuration,
                {
                  clipFile,
                  error:
                    songError instanceof Error
                      ? songError.message
                      : String(songError),
                },
                userId,
                sessionId
              );

              console.error(
                "Failed to save song to DB after retries:",
                songError,
                "for file:",
                clipFile
              );

              // 실패한 작업을 큐에 추가
              queueFailedOperation(
                {
                  type: "INSERT_SONG",
                  data: {
                    title: title,
                    artist: "Unknown",
                    album: "Unknown",
                    clip_path: `/clips/${clipFile}`,
                    full_path: null,
                    duration: 180,
                    clip_start: 30,
                    clip_end: 40,
                  },
                },
                userId!,
                sessionId
              );
            }
          } else {
            console.log(
              "Skipping old file:",
              clipFile,
              "modified:",
              stats.mtime
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing clip files:", error);
      console.error("Error details:", error);
    }

    // 클립 파일 처리 완료 로깅
    const clipProcessingDuration = endPerformanceTimer(
      clipProcessingTimerId,
      "database",
      "Clip File Processing",
      true,
      { processedSongs: songsData.length },
      userId,
      sessionId
    );

    logProcessingStep(
      "Clip File Processing Complete",
      "database_save",
      `Processed ${songsData.length} clips`,
      true,
      clipProcessingDuration,
      { processedSongs: songsData.length, sessionId },
      userId,
      sessionId
    );

    console.log(`Total songs processed: ${songsData.length}`);

    // 처리 완료 진행률 업데이트 (반드시 설정)
    const completionProgress = {
      type: "completion",
      current: songsData.length,
      total: songsData.length || 1,
      percentage: 100,
      step: "처리 완료",
      song_title:
        songsData.length > 0
          ? `${songsData.length}개 클립 생성이 완료되었습니다!`
          : "처리가 완료되었지만 생성된 클립이 없습니다.",
      clips_completed: songsData.length,
      successful: songsData.length,
      failed: 0, // 실패 개수는 Python 스크립트에서 계산되지만 여기서는 0으로 설정
      quick_play: quickPlay,
      game_id: gameId,
      timestamp: new Date().toISOString(),
    };

    try {
      const { progressStore } = require("@/lib/progress-store");
      progressStore.set(user.id, completionProgress);

      // 클립 모니터링 중단
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`;
      fetch(`${baseUrl}/api/progress/monitor-clips`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      }).catch((err) =>
        console.warn("Failed to stop clip monitoring:", err)
      );

      // WebSocket으로도 completion progress 전송
      fetch(`${baseUrl}/api/progress/websocket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          progressData: completionProgress,
        }),
      }).catch((err) =>
        console.warn("Failed to send completion progress via WebSocket:", err)
      );

      console.log(
        "Completion progress set for user:",
        user.id,
        "- songs processed:",
        songsData.length,
        "- gameId:",
        gameId
      );
    } catch (err) {
      console.warn("Failed to set completion progress:", err);
    }

    // Quick Play 모드인 경우 자동으로 게임 생성
    if (quickPlay && songsData.length > 0) {
      try {
        // 자동으로 게임 생성
        const gameData = {
          id: `quick-${Date.now()}`,
          name: quizName || `Quick Play - ${new Date().toLocaleDateString()}`,
          description: "Quick Play로 자동 생성된 퀴즈",
          difficulty: difficulty || "medium",
          question_count: Math.min(songsData.length, questionCount || 5),
          created_by: user.id,
          is_public: isPublic || false,
        };

        // 안정성이 강화된 게임 저장
        const newGame = await saveGameWithRetry(
          {
            id: gameData.id,
            name: gameData.name,
            description: gameData.description,
            difficulty: gameData.difficulty as "easy" | "medium" | "hard",
            question_count: gameData.question_count,
            is_public: gameData.is_public,
          },
          userId,
          supabase // 서비스 역할 키 클라이언트 전달
        );

        gameId = newGame.id;
        console.log("Quick Play game saved with retry:", newGame.name);

        // 다른 곡들에서 오답 선택지 생성 (원본 제목 사용)
        const allSongs = songsData;
        const generateOptions = (correctSong, allSongs, count = 4) => {
          const correctTitle = correctSong.title; // 원본 YouTube 제목 사용
          const options = [correctTitle];
          const otherSongs = allSongs.filter((s) => s.id !== correctSong.id);

          while (options.length < count && otherSongs.length > 0) {
            const randomSong = otherSongs.splice(
              Math.floor(Math.random() * otherSongs.length),
              1
            )[0];
            if (!options.includes(randomSong.title)) {
              options.push(randomSong.title);
            }
          }

          // 선택지 섞기
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }

          return options;
        };

        // 자동으로 질문들 생성
        const questionsToInsert = songsData
          .slice(0, questionCount || 5)
          .map((song, index) => {
            const options = generateOptions(song, allSongs);

            return {
              id: `q-${gameId}-${index + 1}`,
              game_id: gameId,
              song_id: song.id,
              question: "이 노래의 제목은?",
              correct_answer: song.title, // 원본 YouTube 제목
              options: options,
              order_index: index + 1,
            };
          });

        // 안정성이 강화된 질문 저장
        try {
          const questionsData = questionsToInsert.map((q) => ({
            song_id: q.song_id,
            question: q.question,
            correct_answer: q.correct_answer,
            options: q.options,
            order_index: q.order_index,
          }));

          if (gameId) {
            await saveQuestionsWithRetry(gameId, questionsData, supabase); // 서비스 역할 키 클라이언트 전달
          }
          console.log(
            `Successfully saved ${questionsData.length} questions with retry`
          );
        } catch (questionsError) {
          console.error(
            "Failed to save questions after retries:",
            questionsError
          );

          // 실패한 작업을 큐에 추가
          if (gameId) {
            queueFailedOperation(
              {
                type: "INSERT_QUESTIONS",
                data: {
                  gameId,
                  questions: questionsToInsert.map((q) => ({
                    song_id: q.song_id,
                    question: q.question,
                    correct_answer: q.correct_answer,
                    options: q.options,
                    order_index: q.order_index,
                  })),
                },
              },
              userId!,
              sessionId
            );
          }
        }
      } catch (quickPlayError) {
        console.error("Quick Play 게임 생성 실패:", quickPlayError);

        // 게임 생성 실패 시 큐에 추가
        if (songsData.length > 0) {
          queueFailedOperation(
            {
              type: "INSERT_GAME",
              data: {
                id: `quick-${Date.now()}`,
                name:
                  quizName || `Quick Play - ${new Date().toLocaleDateString()}`,
                description: "Quick Play로 자동 생성된 퀴즈",
                difficulty: difficulty || "medium",
                question_count: Math.min(songsData.length, questionCount || 5),
                is_public: isPublic || false,
              },
            },
            userId!,
            sessionId
          );
        }
      }
    }

    // 실패한 작업 재시도 시스템 시작 (30초 간격)
    startFailedOperationsRetry(30000);

    // 세션 완료 로깅
    const sessionMetrics = endSession(sessionId);

    if (sessionMetrics) {
      console.log(`Session ${sessionId} completed:`, {
        totalDuration: sessionMetrics.totalDuration,
        totalOperations: sessionMetrics.summary.totalOperations,
        successfulOperations: sessionMetrics.summary.successfulOperations,
        failedOperations: sessionMetrics.summary.failedOperations,
        averageOperationTime: Math.round(
          sessionMetrics.summary.averageOperationTime
        ),
        songsProcessed: songsData.length,
      });
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: "Music processing completed",
      processedUrls: urlRecords.length,
      songsCreated: songsData.length,
      gameId,
      quickPlay,
      output: stdout,
      errors: stderr,
      sessionId,
      sessionMetrics: sessionMetrics
        ? {
            totalDuration: sessionMetrics.totalDuration,
            totalOperations: sessionMetrics.summary.totalOperations,
            successRate:
              sessionMetrics.summary.successfulOperations /
              sessionMetrics.summary.totalOperations,
          }
        : null,
      songsData: songsData.map((song) => ({
        id: song.id,
        title: song.title,
      })),
    });
  } catch (error) {
    console.error("Error processing URLs:", error);

    // 오류 발생 시에도 세션 종료
    if (userId) {
      try {
        const sessionMetrics = endSession(sessionId);
        if (sessionMetrics) {
          console.log(`Session ${sessionId} ended with error:`, {
            totalDuration: sessionMetrics.totalDuration,
            totalOperations: sessionMetrics.summary.totalOperations,
            failedOperations: sessionMetrics.summary.failedOperations,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } catch (sessionError) {
        console.warn("Failed to end session properly:", sessionError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process URLs",
        details: error instanceof Error ? error.message : "Unknown error",
        sessionId,
      },
      { status: 500 }
    );
  }
}
