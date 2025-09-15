"use client";

export interface LogLevel {
  DEBUG: "debug";
  INFO: "info";
  WARN: "warn";
  ERROR: "error";
  PERFORMANCE: "performance";
}

export const LOG_LEVELS: LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  PERFORMANCE: "performance",
};

export interface LogEntry {
  timestamp: string;
  level: keyof LogLevel;
  category: string;
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  duration?: number;
  stackTrace?: string;
}

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
  error?: string;
}

export interface SessionMetrics {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  operations: PerformanceMetric[];
  errors: LogEntry[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    totalProcessingTime: number;
  };
  metadata?: {
    stepPerformance?: Array<{
      stepName: string;
      stepType: string;
      songTitle: string;
      duration: number;
      success: boolean;
      timestamp: number;
      metadata?: Record<string, any>;
    }>;
    databaseMetrics?: {
      totalQueries: number;
      successfulQueries: number;
      failedQueries: number;
      averageQueryTime: number;
      slowQueries: number;
      retryCount: number;
    };
    performanceIssues?: Array<{
      type:
        | "slow_operation"
        | "high_failure_rate"
        | "memory_usage"
        | "network_timeout";
      description: string;
      timestamp: number;
      severity: "low" | "medium" | "high";
      metadata?: Record<string, any>;
    }>;
  };
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private performanceTimers: Map<string, number> = new Map();
  private maxLogEntries = 1000; // 메모리 관리를 위한 최대 로그 수

  private constructor() {
    // 브라우저 환경에서만 실행
    if (typeof window !== "undefined") {
      // 페이지 언로드 시 로그 전송
      window.addEventListener("beforeunload", () => {
        this.flushLogs();
      });
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // 기본 로깅 메서드
  private log(
    level: keyof LogLevel,
    category: string,
    message: string,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    // 브라우저 환경에서만 실행
    if (typeof window === "undefined") {
      return;
    }
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      userId,
      sessionId,
      metadata,
    };

    // 오류인 경우 스택 트레이스 추가
    if (level === "error") {
      entry.stackTrace = new Error().stack;
    }

    this.logs.push(entry);

    // 메모리 관리
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // 콘솔에도 출력 (개발 환경)
    if (process.env.NODE_ENV === "development") {
      const consoleMethod =
        level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[consoleMethod](
        `[${level.toUpperCase()}] ${category}: ${message}`,
        metadata || ""
      );
    }

    // 세션 메트릭에 오류 추가
    if (level === "error" && sessionId) {
      const session = this.sessionMetrics.get(sessionId);
      if (session) {
        session.errors.push(entry);
      }
    }

    // 서버로 로그 전송 (중요한 로그만)
    if (level === "error" || level === "performance") {
      this.sendLogToServer(entry);
    }
  }

  // 공개 로깅 메서드들
  debug(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    this.log("debug", category, message, metadata, userId, sessionId);
  }

  info(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    this.log("info", category, message, metadata, userId, sessionId);
  }

  warn(
    category: string,
    message: string,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    this.log("warn", category, message, metadata, userId, sessionId);
  }

  error(
    category: string,
    message: string,
    error?: Error,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    const errorMetadata = {
      ...metadata,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    this.log("error", category, message, errorMetadata, userId, sessionId);
  }

  // 성능 측정 시작
  startPerformanceTimer(operationId: string): void {
    this.performanceTimers.set(operationId, Date.now());
  }

  // 성능 측정 종료 및 로깅
  endPerformanceTimer(
    operationId: string,
    category: string,
    operation: string,
    success: boolean = true,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): number {
    const startTime = this.performanceTimers.get(operationId);
    if (!startTime) {
      this.warn(
        "performance",
        `Performance timer not found for operation: ${operationId}`
      );
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.performanceTimers.delete(operationId);

    const performanceMetadata = {
      ...metadata,
      operation,
      duration,
      success,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    };

    this.log(
      "performance",
      category,
      `${operation} completed in ${duration}ms`,
      performanceMetadata,
      userId,
      sessionId
    );

    // 세션 메트릭에 추가
    if (sessionId) {
      this.addOperationToSession(sessionId, {
        operation,
        startTime,
        endTime,
        duration,
        success,
        metadata,
        error: success ? undefined : metadata?.error,
      });
    }

    return duration;
  }

  // 세션 시작
  startSession(sessionId: string, userId: string): void {
    // 브라우저 환경에서만 실행
    if (typeof window === "undefined") {
      return;
    }
    const session: SessionMetrics = {
      sessionId,
      userId,
      startTime: Date.now(),
      operations: [],
      errors: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageOperationTime: 0,
        totalProcessingTime: 0,
      },
    };

    this.sessionMetrics.set(sessionId, session);
    this.info(
      "session",
      `Session started for user ${userId}`,
      { sessionId },
      userId,
      sessionId
    );
  }

  // 세션 종료
  endSession(sessionId: string): SessionMetrics | null {
    // 브라우저 환경에서만 실행
    if (typeof window === "undefined") {
      return null;
    }
    const session = this.sessionMetrics.get(sessionId);
    if (!session) {
      this.warn("session", `Session not found: ${sessionId}`);
      return null;
    }

    session.endTime = Date.now();
    session.totalDuration = session.endTime - session.startTime;

    // 요약 통계 계산
    session.summary.totalOperations = session.operations.length;
    session.summary.successfulOperations = session.operations.filter(
      (op) => op.success
    ).length;
    session.summary.failedOperations = session.operations.filter(
      (op) => !op.success
    ).length;
    session.summary.totalProcessingTime = session.operations.reduce(
      (sum, op) => sum + (op.duration || 0),
      0
    );
    session.summary.averageOperationTime =
      session.summary.totalOperations > 0
        ? session.summary.totalProcessingTime / session.summary.totalOperations
        : 0;

    // 성능 이슈 분석 및 기록
    this.analyzeSessionPerformance(session);

    this.info(
      "session",
      `Session completed`,
      {
        sessionId,
        duration: session.totalDuration,
        summary: session.summary,
        performanceIssues: session.metadata?.performanceIssues?.length || 0,
        databaseMetrics: session.metadata?.databaseMetrics,
      },
      session.userId,
      sessionId
    );

    // 서버로 세션 메트릭 전송
    this.sendSessionMetricsToServer(session);

    return session;
  }

  // 세션 성능 분석
  private analyzeSessionPerformance(session: SessionMetrics): void {
    if (!session.metadata) {
      session.metadata = {};
    }
    if (!session.metadata.performanceIssues) {
      session.metadata.performanceIssues = [];
    }

    const issues = session.metadata.performanceIssues;

    // 1. 전체 세션 시간 분석
    if (session.totalDuration && session.totalDuration > 30 * 60 * 1000) {
      // 30분 이상
      issues.push({
        type: "slow_operation",
        description: `Session duration exceeded 30 minutes: ${Math.round(
          session.totalDuration / 1000 / 60
        )}min`,
        timestamp: Date.now(),
        severity: "high",
        metadata: { duration: session.totalDuration },
      });
    }

    // 2. 실패율 분석
    const failureRate =
      session.summary.totalOperations > 0
        ? session.summary.failedOperations / session.summary.totalOperations
        : 0;

    if (failureRate > 0.3) {
      // 30% 이상 실패
      issues.push({
        type: "high_failure_rate",
        description: `High failure rate: ${Math.round(failureRate * 100)}%`,
        timestamp: Date.now(),
        severity: failureRate > 0.5 ? "high" : "medium",
        metadata: {
          failureRate,
          totalOperations: session.summary.totalOperations,
          failedOperations: session.summary.failedOperations,
        },
      });
    }

    // 3. 데이터베이스 성능 분석
    if (session.metadata.databaseMetrics) {
      const dbMetrics = session.metadata.databaseMetrics;

      if (dbMetrics.slowQueries > 0) {
        const slowQueryRate = dbMetrics.slowQueries / dbMetrics.totalQueries;
        if (slowQueryRate > 0.2) {
          // 20% 이상이 느린 쿼리
          issues.push({
            type: "slow_operation",
            description: `High slow query rate: ${Math.round(
              slowQueryRate * 100
            )}% (${dbMetrics.slowQueries}/${dbMetrics.totalQueries})`,
            timestamp: Date.now(),
            severity: slowQueryRate > 0.5 ? "high" : "medium",
            metadata: {
              slowQueryRate,
              slowQueries: dbMetrics.slowQueries,
              totalQueries: dbMetrics.totalQueries,
              averageQueryTime: dbMetrics.averageQueryTime,
            },
          });
        }
      }

      if (dbMetrics.retryCount > 5) {
        issues.push({
          type: "network_timeout",
          description: `High database retry count: ${dbMetrics.retryCount}`,
          timestamp: Date.now(),
          severity: dbMetrics.retryCount > 10 ? "high" : "medium",
          metadata: { retryCount: dbMetrics.retryCount },
        });
      }
    }

    // 4. 단계별 성능 분석
    if (session.metadata.stepPerformance) {
      const stepPerf = session.metadata.stepPerformance;
      const stepTypes = [
        "download",
        "clip_generation",
        "metadata_extraction",
        "database_save",
      ];

      for (const stepType of stepTypes) {
        const stepsOfType = stepPerf.filter((s) => s.stepType === stepType);
        if (stepsOfType.length > 0) {
          const avgDuration =
            stepsOfType.reduce((sum, s) => sum + s.duration, 0) /
            stepsOfType.length;
          const failureRate =
            stepsOfType.filter((s) => !s.success).length / stepsOfType.length;

          // 단계별 임계값
          const thresholds = {
            download: 30000,
            clip_generation: 5000,
            metadata_extraction: 1000,
            database_save: 2000,
          };

          if (avgDuration > thresholds[stepType as keyof typeof thresholds]) {
            issues.push({
              type: "slow_operation",
              description: `Slow ${stepType} operations: avg ${Math.round(
                avgDuration
              )}ms`,
              timestamp: Date.now(),
              severity:
                avgDuration >
                thresholds[stepType as keyof typeof thresholds] * 2
                  ? "high"
                  : "medium",
              metadata: {
                stepType,
                averageDuration: avgDuration,
                threshold: thresholds[stepType as keyof typeof thresholds],
                operationCount: stepsOfType.length,
              },
            });
          }

          if (failureRate > 0.2) {
            issues.push({
              type: "high_failure_rate",
              description: `High ${stepType} failure rate: ${Math.round(
                failureRate * 100
              )}%`,
              timestamp: Date.now(),
              severity: failureRate > 0.5 ? "high" : "medium",
              metadata: {
                stepType,
                failureRate,
                operationCount: stepsOfType.length,
              },
            });
          }
        }
      }
    }

    // 성능 이슈가 발견된 경우 로깅
    if (issues.length > 0) {
      this.warn(
        "session-analysis",
        `Performance issues detected in session ${session.sessionId}`,
        {
          sessionId: session.sessionId,
          userId: session.userId,
          issueCount: issues.length,
          issues: issues.map((i) => ({
            type: i.type,
            severity: i.severity,
            description: i.description,
          })),
        },
        session.userId,
        session.sessionId
      );
    }
  }

  // 세션에 작업 추가
  private addOperationToSession(
    sessionId: string,
    operation: PerformanceMetric
  ): void {
    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      session.operations.push(operation);
    }
  }

  // 데이터베이스 작업 로깅
  logDatabaseOperation(
    operation: string,
    table: string,
    success: boolean,
    duration: number,
    recordCount?: number,
    error?: Error,
    userId?: string,
    sessionId?: string
  ): void {
    const metadata = {
      table,
      recordCount,
      duration,
      success,
      error: error?.message,
    };

    if (success) {
      this.info(
        "database",
        `${operation} on ${table} completed successfully`,
        metadata,
        userId,
        sessionId
      );
    } else {
      this.error(
        "database",
        `${operation} on ${table} failed`,
        error,
        metadata,
        userId,
        sessionId
      );
    }
  }

  // 향상된 데이터베이스 작업 로깅
  logEnhancedDatabaseOperation(
    operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
    table: string,
    success: boolean,
    duration: number,
    options: {
      recordCount?: number;
      retryAttempt?: number;
      queryComplexity?: "simple" | "medium" | "complex";
      indexUsed?: boolean;
      transactionId?: string;
      error?: Error;
      metadata?: Record<string, any>;
    } = {},
    userId?: string,
    sessionId?: string
  ): void {
    const {
      recordCount,
      retryAttempt = 0,
      queryComplexity = "simple",
      indexUsed,
      transactionId,
      error,
      metadata: additionalMetadata,
    } = options;

    // 성능 임계값 (테이블별로 다르게 설정 가능)
    const performanceThresholds = {
      songs: { simple: 1000, medium: 3000, complex: 10000 },
      games: { simple: 500, medium: 2000, complex: 5000 },
      questions: { simple: 2000, medium: 5000, complex: 15000 },
      youtube_urls: { simple: 500, medium: 1500, complex: 3000 },
    };

    const threshold =
      performanceThresholds[table as keyof typeof performanceThresholds]?.[
        queryComplexity
      ] || 2000;
    const isSlowQuery = duration > threshold;

    const dbMetadata = {
      operation,
      table,
      recordCount,
      duration,
      success,
      retryAttempt,
      queryComplexity,
      indexUsed,
      transactionId,
      isSlowQuery,
      threshold,
      timestamp: new Date().toISOString(),
      performanceCategory: "database-operation",
      error: error?.message,
      errorCode: (error as any)?.code,
      ...additionalMetadata,
    };

    // 성능 이슈 감지
    if (isSlowQuery) {
      dbMetadata.performanceIssue = "slow_query";
    }

    if (retryAttempt > 0) {
      dbMetadata.performanceIssue = "retry_required";
    }

    const message = `Database ${operation} on ${table} ${
      success ? "completed" : "failed"
    } in ${duration}ms${retryAttempt > 0 ? ` (retry ${retryAttempt})` : ""}${
      isSlowQuery ? " (SLOW)" : ""
    }${recordCount ? ` (${recordCount} records)` : ""}`;

    if (success) {
      if (isSlowQuery || retryAttempt > 0) {
        this.warn(
          "database-performance",
          message,
          dbMetadata,
          userId,
          sessionId
        );
      } else {
        this.info(
          "database-performance",
          message,
          dbMetadata,
          userId,
          sessionId
        );
      }
    } else {
      this.error(
        "database-performance",
        message,
        error,
        dbMetadata,
        userId,
        sessionId
      );
    }

    // 세션에 데이터베이스 메트릭 추가
    if (sessionId) {
      this.addDatabaseMetricsToSession(sessionId, {
        operation,
        table,
        duration,
        success,
        retryAttempt,
        isSlowQuery,
        recordCount: recordCount || 0,
      });
    }
  }

  // 세션에 데이터베이스 메트릭 추가
  private addDatabaseMetricsToSession(
    sessionId: string,
    dbOperation: {
      operation: string;
      table: string;
      duration: number;
      success: boolean;
      retryAttempt: number;
      isSlowQuery: boolean;
      recordCount: number;
    }
  ): void {
    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      if (!session.metadata) {
        session.metadata = {};
      }
      if (!session.metadata.databaseMetrics) {
        session.metadata.databaseMetrics = {
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          averageQueryTime: 0,
          slowQueries: 0,
          retryCount: 0,
        };
      }

      const metrics = session.metadata.databaseMetrics;
      metrics.totalQueries++;

      if (dbOperation.success) {
        metrics.successfulQueries++;
      } else {
        metrics.failedQueries++;
      }

      if (dbOperation.isSlowQuery) {
        metrics.slowQueries++;
      }

      if (dbOperation.retryAttempt > 0) {
        metrics.retryCount += dbOperation.retryAttempt;
      }

      // 평균 쿼리 시간 업데이트
      metrics.averageQueryTime =
        (metrics.averageQueryTime * (metrics.totalQueries - 1) +
          dbOperation.duration) /
        metrics.totalQueries;
    }
  }

  // 클립 처리 단계별 로깅
  logClipProcessingStep(
    step: string,
    songTitle: string,
    success: boolean,
    duration: number,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    const stepMetadata = {
      ...metadata,
      step,
      songTitle,
      duration,
      success,
    };

    const message = `Clip processing step '${step}' for '${songTitle}' ${
      success ? "completed" : "failed"
    } in ${duration}ms`;

    if (success) {
      this.info("clip-processing", message, stepMetadata, userId, sessionId);
    } else {
      this.error(
        "clip-processing",
        message,
        undefined,
        stepMetadata,
        userId,
        sessionId
      );
    }
  }

  // 단계별 처리 시간 로깅 (향상된 버전)
  logProcessingStep(
    stepName: string,
    stepType:
      | "download"
      | "clip_generation"
      | "metadata_extraction"
      | "database_save"
      | "file_cleanup",
    songTitle: string,
    success: boolean,
    duration: number,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    const stepMetadata = {
      ...metadata,
      stepName,
      stepType,
      songTitle,
      duration,
      success,
      timestamp: new Date().toISOString(),
      performanceCategory: "step-timing",
    };

    // 성능 임계값 확인
    const performanceThresholds = {
      download: 30000, // 30초
      clip_generation: 5000, // 5초
      metadata_extraction: 1000, // 1초
      database_save: 2000, // 2초
      file_cleanup: 1000, // 1초
    };

    const threshold = performanceThresholds[stepType];
    const isSlowOperation = duration > threshold;

    if (isSlowOperation) {
      stepMetadata.performanceIssue = "slow_operation";
      stepMetadata.threshold = threshold;
    }

    const message = `Processing step '${stepName}' (${stepType}) for '${songTitle}' ${
      success ? "completed" : "failed"
    } in ${duration}ms${isSlowOperation ? " (SLOW)" : ""}`;

    if (success) {
      if (isSlowOperation) {
        this.warn("step-performance", message, stepMetadata, userId, sessionId);
      } else {
        this.info("step-performance", message, stepMetadata, userId, sessionId);
      }
    } else {
      this.error(
        "step-performance",
        message,
        undefined,
        stepMetadata,
        userId,
        sessionId
      );
    }

    // 세션에 단계별 성능 데이터 추가
    if (sessionId) {
      this.addStepPerformanceToSession(sessionId, {
        stepName,
        stepType,
        songTitle,
        duration,
        success,
        timestamp: Date.now(),
        metadata: stepMetadata,
      });
    }
  }

  // 세션에 단계별 성능 데이터 추가
  private addStepPerformanceToSession(
    sessionId: string,
    stepData: {
      stepName: string;
      stepType: string;
      songTitle: string;
      duration: number;
      success: boolean;
      timestamp: number;
      metadata?: Record<string, any>;
    }
  ): void {
    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      if (!session.metadata) {
        session.metadata = {};
      }
      if (!session.metadata.stepPerformance) {
        session.metadata.stepPerformance = [];
      }
      session.metadata.stepPerformance.push(stepData);
    }
  }

  // 로그 조회
  getLogs(filter?: {
    level?: keyof LogLevel;
    category?: string;
    userId?: string;
    sessionId?: string;
    startTime?: Date;
    endTime?: Date;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter((log) => log.level === filter.level);
      }
      if (filter.category) {
        filteredLogs = filteredLogs.filter(
          (log) => log.category === filter.category
        );
      }
      if (filter.userId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.userId === filter.userId
        );
      }
      if (filter.sessionId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.sessionId === filter.sessionId
        );
      }
      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(
          (log) => new Date(log.timestamp) >= filter.startTime!
        );
      }
      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(
          (log) => new Date(log.timestamp) <= filter.endTime!
        );
      }
    }

    return filteredLogs;
  }

  // 세션 메트릭 조회
  getSessionMetrics(sessionId: string): SessionMetrics | null {
    return this.sessionMetrics.get(sessionId) || null;
  }

  // 모든 세션 메트릭 조회
  getAllSessionMetrics(): SessionMetrics[] {
    return Array.from(this.sessionMetrics.values());
  }

  // 서버로 로그 전송
  private async sendLogToServer(logEntry: LogEntry): Promise<void> {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      // 로그 전송 실패는 콘솔에만 출력 (무한 루프 방지)
      console.warn("Failed to send log to server:", error);
    }
  }

  // 서버로 세션 메트릭 전송
  private async sendSessionMetricsToServer(
    session: SessionMetrics
  ): Promise<void> {
    try {
      await fetch("/api/metrics/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(session),
      });
    } catch (error) {
      console.warn("Failed to send session metrics to server:", error);
    }
  }

  // 로그 플러시 (페이지 종료 시)
  private flushLogs(): void {
    // 중요한 로그들을 서버로 전송
    const importantLogs = this.logs.filter(
      (log) => log.level === "error" || log.level === "performance"
    );

    if (importantLogs.length > 0) {
      // Beacon API 사용 (페이지 언로드 시에도 전송 보장)
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/logs/batch", JSON.stringify(importantLogs));
      }
    }
  }

  // 로그 정리
  clearLogs(): void {
    this.logs = [];
    this.sessionMetrics.clear();
    this.performanceTimers.clear();
  }
}

// 싱글톤 인스턴스 내보내기
export const logger = Logger.getInstance();

// 편의 함수들
export function logError(
  category: string,
  message: string,
  error?: Error,
  metadata?: Record<string, any>,
  userId?: string,
  sessionId?: string
): void {
  logger.error(category, message, error, metadata, userId, sessionId);
}

export function logPerformance(
  category: string,
  operation: string,
  duration: number,
  success: boolean = true,
  metadata?: Record<string, any>,
  userId?: string,
  sessionId?: string
): void {
  logger.info(
    category,
    `${operation} completed in ${duration}ms`,
    {
      ...metadata,
      operation,
      duration,
      success,
    },
    userId,
    sessionId
  );
}

export function logDatabaseOperation(
  operation: string,
  table: string,
  success: boolean,
  duration: number,
  recordCount?: number,
  error?: Error,
  userId?: string,
  sessionId?: string
): void {
  logger.logDatabaseOperation(
    operation,
    table,
    success,
    duration,
    recordCount,
    error,
    userId,
    sessionId
  );
}

export function startPerformanceTimer(operationId: string): void {
  logger.startPerformanceTimer(operationId);
}

export function endPerformanceTimer(
  operationId: string,
  category: string,
  operation: string,
  success?: boolean,
  metadata?: Record<string, any>,
  userId?: string,
  sessionId?: string
): number {
  return logger.endPerformanceTimer(
    operationId,
    category,
    operation,
    success,
    metadata,
    userId,
    sessionId
  );
}

export function startSession(sessionId: string, userId: string): void {
  logger.startSession(sessionId, userId);
}

export function endSession(sessionId: string): SessionMetrics | null {
  return logger.endSession(sessionId);
}

// 향상된 로깅을 위한 편의 함수들
export function logProcessingStep(
  stepName: string,
  stepType:
    | "download"
    | "clip_generation"
    | "metadata_extraction"
    | "database_save"
    | "file_cleanup",
  songTitle: string,
  success: boolean,
  duration: number,
  metadata?: Record<string, any>,
  userId?: string,
  sessionId?: string
): void {
  logger.logProcessingStep(
    stepName,
    stepType,
    songTitle,
    success,
    duration,
    metadata,
    userId,
    sessionId
  );
}

export function logEnhancedDatabaseOperation(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
  table: string,
  success: boolean,
  duration: number,
  options: {
    recordCount?: number;
    retryAttempt?: number;
    queryComplexity?: "simple" | "medium" | "complex";
    indexUsed?: boolean;
    transactionId?: string;
    error?: Error;
    metadata?: Record<string, any>;
  } = {},
  userId?: string,
  sessionId?: string
): void {
  logger.logEnhancedDatabaseOperation(
    operation,
    table,
    success,
    duration,
    options,
    userId,
    sessionId
  );
}

// 성능 메트릭 조회 함수들
export function getSessionPerformanceMetrics(
  sessionId: string
): SessionMetrics | null {
  return logger.getSessionMetrics(sessionId);
}

export function getAllSessionsPerformanceMetrics(): SessionMetrics[] {
  return logger.getAllSessionMetrics();
}

export function getPerformanceLogs(filter?: {
  level?: keyof LogLevel;
  category?: string;
  userId?: string;
  sessionId?: string;
  startTime?: Date;
  endTime?: Date;
}): LogEntry[] {
  return logger.getLogs(filter);
}
