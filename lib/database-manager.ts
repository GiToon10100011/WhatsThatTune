import { supabase } from "./supabase";
import { getCurrentUser } from "./auth";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  serverLogger,
  logDatabaseOperation,
  logEnhancedDatabaseOperation,
  startPerformanceTimer,
  endPerformanceTimer,
} from "./server-logger";

// 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1초
  maxDelay: 10000, // 10초
  backoffMultiplier: 2,
};

// 데이터베이스 작업 타입
export type DatabaseOperation =
  | { type: "INSERT_SONG"; data: any }
  | { type: "INSERT_GAME"; data: any }
  | { type: "INSERT_QUESTIONS"; data: any[] }
  | { type: "UPDATE_URL_STATUS"; data: { id: string; processed: boolean } };

// 컨텍스트가 포함된 데이터베이스 작업 타입
export interface DatabaseOperationWithContext {
  operation: DatabaseOperation;
  userId: string;
  sessionId?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// 실패한 작업 큐 (컨텍스트 포함)
const failedOperationsQueue: DatabaseOperationWithContext[] = [];

// 재시도 지연 계산
function calculateDelay(attempt: number): number {
  const delay =
    RETRY_CONFIG.baseDelay *
    Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

// 재시도 가능한 오류인지 확인
function isRetryableError(error: any): boolean {
  if (!error) return false;

  // PostgreSQL 오류 코드 확인
  const retryableCodes = [
    "08000", // connection_exception
    "08003", // connection_does_not_exist
    "08006", // connection_failure
    "53300", // too_many_connections
    "40001", // serialization_failure
    "40P01", // deadlock_detected
  ];

  // Supabase/PostgREST 오류 확인
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // 네트워크 오류 확인
  if (error.message) {
    const retryableMessages = [
      "network error",
      "timeout",
      "connection",
      "ECONNRESET",
      "ENOTFOUND",
      "ETIMEDOUT",
    ];

    const message = error.message.toLowerCase();
    return retryableMessages.some((msg) => message.includes(msg));
  }

  return false;
}

// 기본 재시도 함수 (향상된 로깅 포함)
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  userId?: string,
  sessionId?: string
): Promise<T> {
  let lastError: any;
  const operationStartTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();

    try {
      console.log(`${operationName} - Attempt ${attempt}/${maxRetries}`);

      // 재시도 시작 로깅
      if (attempt > 1) {
        serverLogger.info(
          "database-retry",
          `Retrying ${operationName} - Attempt ${attempt}/${maxRetries}`,
          {
            operationName,
            attempt,
            maxRetries,
            previousError: lastError?.message,
            isRetryableError: isRetryableError(lastError),
          },
          userId,
          sessionId
        );
      }

      const result = await operation();
      const attemptDuration = Date.now() - attemptStartTime;
      const totalDuration = Date.now() - operationStartTime;

      if (attempt > 1) {
        console.log(`${operationName} - Success on attempt ${attempt}`);

        // 재시도 성공 로깅
        serverLogger.info(
          "database-retry",
          `${operationName} succeeded after ${attempt} attempts`,
          {
            operationName,
            totalAttempts: attempt,
            totalDuration,
            finalAttemptDuration: attemptDuration,
            retriesRequired: attempt - 1,
          },
          userId,
          sessionId
        );
      }

      return result;
    } catch (error) {
      lastError = error;
      const attemptDuration = Date.now() - attemptStartTime;

      console.error(`${operationName} - Attempt ${attempt} failed:`, error);

      // 재시도 실패 로깅
      serverLogger.warn(
        "database-retry",
        `${operationName} attempt ${attempt} failed`,
        {
          operationName,
          attempt,
          maxRetries,
          attemptDuration,
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any)?.code,
          isRetryableError: isRetryableError(error),
          willRetry: attempt < maxRetries && isRetryableError(error),
        },
        userId,
        sessionId
      );

      // 마지막 시도이거나 재시도 불가능한 오류인 경우
      if (attempt === maxRetries || !isRetryableError(error)) {
        break;
      }

      // 재시도 전 대기
      const delay = calculateDelay(attempt);
      console.log(`${operationName} - Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 최종 실패 로깅
  const totalDuration = Date.now() - operationStartTime;
  serverLogger.error(
    "database-retry",
    `${operationName} failed after ${maxRetries} attempts`,
    lastError,
    {
      operationName,
      totalAttempts: maxRetries,
      totalDuration,
      finalError: lastError?.message,
      finalErrorCode: (lastError as any)?.code,
    },
    userId,
    sessionId
  );

  throw lastError;
}

// 노래 저장 (재시도 포함) - 사용자 ID를 직접 받도록 수정
export async function saveSongWithRetry(
  songData: {
    title: string;
    artist?: string;
    album?: string;
    clip_path: string;
    full_path?: string | null;
    duration: number;
    clip_start: number;
    clip_end: number;
  },
  userId?: string,
  supabaseClient?: SupabaseClient
): Promise<any> {
  // 사용자 ID가 제공되지 않은 경우에만 getCurrentUser 호출
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated");
    }
    effectiveUserId = user.id;
  }

  // Supabase 클라이언트 선택 (서비스 역할 키 우선)
  const client = supabaseClient || supabase;

  const operationId = `save-song-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  startPerformanceTimer(operationId);

  try {
    const result = await withRetry(
      async () => {
        // Generate a unique ID for the song
        const songId = `song_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const { data, error } = await client
          .from("songs")
          .insert({
            id: songId,
            title: songData.title,
            artist: songData.artist || "Unknown",
            album: songData.album || "Unknown",
            clip_path: songData.clip_path,
            full_path: songData.full_path,
            duration: songData.duration,
            clip_start: songData.clip_start,
            clip_end: songData.clip_end,
            created_by: effectiveUserId,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      },
      `Save Song: ${songData.title}`,
      RETRY_CONFIG.maxRetries,
      effectiveUserId
    );

    const duration = endPerformanceTimer(
      operationId,
      "database",
      "save-song",
      true,
      {
        title: songData.title,
        clipPath: songData.clip_path,
      },
      effectiveUserId
    );

    logDatabaseOperation(
      "INSERT",
      "songs",
      true,
      duration,
      1,
      undefined,
      effectiveUserId
    );

    // 향상된 데이터베이스 로깅
    logEnhancedDatabaseOperation(
      "INSERT",
      "songs",
      true,
      duration,
      {
        recordCount: 1,
        queryComplexity: "simple",
        metadata: {
          title: songData.title,
          clipPath: songData.clip_path,
          operationType: "song_creation",
        },
      },
      effectiveUserId
    );

    return result;
  } catch (error) {
    const duration = endPerformanceTimer(
      operationId,
      "database",
      "save-song",
      false,
      {
        title: songData.title,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      effectiveUserId
    );

    logDatabaseOperation(
      "INSERT",
      "songs",
      false,
      duration,
      0,
      error instanceof Error ? error : new Error(String(error)),
      effectiveUserId
    );

    // 향상된 데이터베이스 로깅
    logEnhancedDatabaseOperation(
      "INSERT",
      "songs",
      false,
      duration,
      {
        recordCount: 0,
        queryComplexity: "simple",
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          title: songData.title,
          operationType: "song_creation",
        },
      },
      effectiveUserId
    );

    throw error;
  }
}

// 게임 저장 (재시도 포함)
export async function saveGameWithRetry(
  gameData: {
    id?: string;
    name: string;
    description?: string;
    difficulty: "easy" | "medium" | "hard";
    question_count: number;
    is_public?: boolean;
  },
  userId?: string,
  supabaseClient?: SupabaseClient
): Promise<any> {
  // 사용자 ID가 제공되지 않은 경우에만 getCurrentUser 호출
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated");
    }
    effectiveUserId = user.id;
  }

  // Supabase 클라이언트 선택 (서비스 역할 키 우선)
  const client = supabaseClient || supabase;

  const operationId = `save-game-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  startPerformanceTimer(operationId);

  try {
    const result = await withRetry(
      async () => {
        const { data, error } = await client
          .from("games")
          .insert({
            id: gameData.id,
            name: gameData.name,
            description: gameData.description || null,
            difficulty: gameData.difficulty,
            question_count: gameData.question_count,
            created_by: effectiveUserId,
            is_public: gameData.is_public || false,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      },
      `Save Game: ${gameData.name}`,
      RETRY_CONFIG.maxRetries,
      effectiveUserId
    );

    const duration = endPerformanceTimer(
      operationId,
      "database",
      "save-game",
      true,
      {
        name: gameData.name,
        difficulty: gameData.difficulty,
        questionCount: gameData.question_count,
      },
      effectiveUserId
    );

    logDatabaseOperation(
      "INSERT",
      "games",
      true,
      duration,
      1,
      undefined,
      effectiveUserId
    );

    // 향상된 데이터베이스 로깅
    logEnhancedDatabaseOperation(
      "INSERT",
      "games",
      true,
      duration,
      {
        recordCount: 1,
        queryComplexity: "simple",
        metadata: {
          name: gameData.name,
          difficulty: gameData.difficulty,
          questionCount: gameData.question_count,
          operationType: "game_creation",
        },
      },
      effectiveUserId
    );

    return result;
  } catch (error) {
    const duration = endPerformanceTimer(
      operationId,
      "database",
      "save-game",
      false,
      {
        name: gameData.name,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      effectiveUserId
    );

    logDatabaseOperation(
      "INSERT",
      "games",
      false,
      duration,
      0,
      error instanceof Error ? error : new Error(String(error)),
      effectiveUserId
    );

    // 향상된 데이터베이스 로깅
    logEnhancedDatabaseOperation(
      "INSERT",
      "games",
      false,
      duration,
      {
        recordCount: 0,
        queryComplexity: "simple",
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          name: gameData.name,
          operationType: "game_creation",
        },
      },
      effectiveUserId
    );

    throw error;
  }
}

// 질문들 저장 (트랜잭션 + 재시도)
export async function saveQuestionsWithRetry(
  gameId: string,
  questionsData: Array<{
    song_id: string;
    question: string;
    correct_answer: string;
    options: string[];
    order_index: number;
  }>,
  supabaseClient?: SupabaseClient
): Promise<any[]> {
  // Supabase 클라이언트 선택 (서비스 역할 키 우선)
  const client = supabaseClient || supabase;

  return withRetry(async () => {
    // 트랜잭션 시뮬레이션 (Supabase는 자동 트랜잭션 지원)
    const questionsToInsert = questionsData.map((q) => ({
      id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      game_id: gameId,
      song_id: q.song_id,
      question: q.question,
      correct_answer: q.correct_answer,
      options: q.options,
      order_index: q.order_index,
    }));

    const { data, error } = await client
      .from("questions")
      .insert(questionsToInsert)
      .select();

    if (error) {
      throw error;
    }

    return data || [];
  }, `Save Questions for Game: ${gameId}`);
}

// URL 상태 업데이트 (재시도 포함)
export async function updateUrlStatusWithRetry(
  urlId: string,
  processed: boolean,
  supabaseClient?: SupabaseClient
): Promise<void> {
  // Supabase 클라이언트 선택 (서비스 역할 키 우선)
  const client = supabaseClient || supabase;

  return withRetry(async () => {
    const { error } = await client
      .from("youtube_urls")
      .update({
        processed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", urlId);

    if (error) {
      throw error;
    }
  }, `Update URL Status: ${urlId}`);
}

// 배치 노래 저장 (트랜잭션 기반)
export async function saveSongsBatch(
  songsData: Array<{
    title: string;
    artist?: string;
    album?: string;
    clip_path: string;
    full_path?: string | null;
    duration: number;
    clip_start: number;
    clip_end: number;
  }>,
  userId?: string,
  supabaseClient?: SupabaseClient
): Promise<any[]> {
  // 사용자 ID가 제공되지 않은 경우에만 getCurrentUser 호출
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated");
    }
    effectiveUserId = user.id;
  }

  // Supabase 클라이언트 선택 (서비스 역할 키 우선)
  const client = supabaseClient || supabase;

  return withRetry(async () => {
    const songsToInsert = songsData.map((song) => ({
      id: `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: song.title,
      artist: song.artist || "Unknown",
      album: song.album || "Unknown",
      clip_path: song.clip_path,
      full_path: song.full_path,
      duration: song.duration,
      clip_start: song.clip_start,
      clip_end: song.clip_end,
      created_by: effectiveUserId,
    }));

    const { data, error } = await client
      .from("songs")
      .insert(songsToInsert)
      .select();

    if (error) {
      throw error;
    }

    return data || [];
  }, `Save Songs Batch: ${songsData.length} songs`);
}

// 실패한 작업 큐에 추가 (사용자 컨텍스트 포함)
export function queueFailedOperation(
  operation: DatabaseOperation,
  userId: string,
  sessionId?: string
): void {
  const operationWithContext: DatabaseOperationWithContext = {
    operation,
    userId,
    sessionId,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: RETRY_CONFIG.maxRetries,
  };

  failedOperationsQueue.push(operationWithContext);
  console.log(`Queued failed operation: ${operation.type} for user: ${userId}`);
}

// 실패한 작업들 재시도
export async function retryFailedOperations(
  supabaseClient?: SupabaseClient
): Promise<void> {
  if (failedOperationsQueue.length === 0) {
    return;
  }

  console.log(`Retrying ${failedOperationsQueue.length} failed operations...`);

  // 서비스 역할 키로 클라이언트 생성 (재시도 시에는 권한 문제를 피하기 위해)
  const serviceClient =
    supabaseClient ||
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

  const operations = [...failedOperationsQueue];
  failedOperationsQueue.length = 0; // 큐 비우기

  for (const operationWithContext of operations) {
    const { operation, userId, sessionId, retryCount, maxRetries } =
      operationWithContext;

    // 최대 재시도 횟수 확인
    if (retryCount >= maxRetries) {
      console.warn(
        `Operation ${operation.type} exceeded max retries (${maxRetries}), discarding`
      );
      continue;
    }

    try {
      switch (operation.type) {
        case "INSERT_SONG":
          await saveSongWithRetry(operation.data, userId, serviceClient);
          break;
        case "INSERT_GAME":
          await saveGameWithRetry(operation.data, userId, serviceClient);
          break;
        case "INSERT_QUESTIONS":
          await saveQuestionsWithRetry(
            (operation.data as any).gameId,
            (operation.data as any).questions,
            serviceClient
          );
          break;
        case "UPDATE_URL_STATUS":
          await updateUrlStatusWithRetry(
            operation.data.id,
            operation.data.processed,
            serviceClient
          );
          break;
      }
      console.log(
        `Successfully retried operation: ${operation.type} for user: ${userId}`
      );
    } catch (error) {
      console.error(
        `Failed to retry operation ${operation.type} for user ${userId}:`,
        error
      );

      // 재시도 횟수 증가하여 다시 큐에 추가
      const updatedOperation: DatabaseOperationWithContext = {
        ...operationWithContext,
        retryCount: retryCount + 1,
      };

      // 최대 재시도 횟수에 도달하지 않은 경우에만 다시 큐에 추가
      if (updatedOperation.retryCount < maxRetries) {
        failedOperationsQueue.push(updatedOperation);
      } else {
        console.error(
          `Operation ${operation.type} for user ${userId} exceeded max retries, discarding`
        );
      }
    }
  }
}

// 데이터베이스 연결 상태 확인
export async function checkDatabaseHealth(
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  try {
    const client = supabaseClient || supabase;
    const { data, error } = await client.from("songs").select("id").limit(1);

    return !error;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// 정기적으로 실패한 작업들 재시도 (백그라운드)
let retryInterval: NodeJS.Timeout | null = null;

export function startFailedOperationsRetry(intervalMs: number = 30000): void {
  if (retryInterval) {
    clearInterval(retryInterval);
  }

  retryInterval = setInterval(async () => {
    if (failedOperationsQueue.length > 0) {
      // 서비스 역할 키로 재시도
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await retryFailedOperations(serviceClient);
    }
    // 주기적으로 오래된 작업들 정리
    cleanupFailedOperations();
  }, intervalMs);

  console.log(`Started failed operations retry with ${intervalMs}ms interval`);
}

export function stopFailedOperationsRetry(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    console.log("Stopped failed operations retry");
  }
}

// 오래된 실패 작업들 정리
export function cleanupFailedOperations(): void {
  const maxAge = 24 * 60 * 60 * 1000; // 24시간
  const maxQueueSize = 1000;
  const now = Date.now();

  // 오래된 작업들 제거
  const beforeCount = failedOperationsQueue.length;
  const filteredQueue = failedOperationsQueue.filter(
    (op) => now - op.timestamp < maxAge
  );

  // 큐 크기가 너무 큰 경우 오래된 것부터 제거
  if (filteredQueue.length > maxQueueSize) {
    filteredQueue.sort((a, b) => a.timestamp - b.timestamp);
    filteredQueue.splice(0, filteredQueue.length - maxQueueSize);
  }

  failedOperationsQueue.length = 0;
  failedOperationsQueue.push(...filteredQueue);

  const afterCount = failedOperationsQueue.length;
  if (beforeCount !== afterCount) {
    console.log(
      `Cleaned up failed operations queue: ${beforeCount} -> ${afterCount}`
    );
  }
}
