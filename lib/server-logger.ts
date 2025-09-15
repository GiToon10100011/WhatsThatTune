// Server-side logger for API routes
export interface ServerLogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "performance";
  category: string;
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  duration?: number;
}

export interface ServerSessionMetrics {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  operations: Array<{
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    metadata?: Record<string, any>;
  }>;
  errors: ServerLogEntry[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    totalProcessingTime: number;
  };
}

class ServerLogger {
  private static instance: ServerLogger;
  private logs: ServerLogEntry[] = [];
  private sessionMetrics: Map<string, ServerSessionMetrics> = new Map();
  private performanceTimers: Map<string, number> = new Map();
  private maxLogEntries = 1000;

  private constructor() {}

  static getInstance(): ServerLogger {
    if (!ServerLogger.instance) {
      ServerLogger.instance = new ServerLogger();
    }
    return ServerLogger.instance;
  }

  private log(
    level: "debug" | "info" | "warn" | "error" | "performance",
    category: string,
    message: string,
    metadata?: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    const entry: ServerLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      userId,
      sessionId,
      metadata,
    };

    this.logs.push(entry);

    // Memory management
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console output for development
    if (process.env.NODE_ENV === "development") {
      const consoleMethod =
        level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[consoleMethod](
        `[${level.toUpperCase()}] ${category}: ${message}`,
        metadata || ""
      );
    }

    // Add errors to session metrics
    if (level === "error" && sessionId) {
      const session = this.sessionMetrics.get(sessionId);
      if (session) {
        session.errors.push(entry);
      }
    }
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

  startPerformanceTimer(operationId: string): void {
    this.performanceTimers.set(operationId, Date.now());
  }

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

    // Add to session metrics
    if (sessionId) {
      this.addOperationToSession(sessionId, {
        operation,
        startTime,
        endTime,
        duration,
        success,
        metadata,
      });
    }

    return duration;
  }

  startSession(sessionId: string, userId: string): void {
    const session: ServerSessionMetrics = {
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

  endSession(sessionId: string): ServerSessionMetrics | null {
    const session = this.sessionMetrics.get(sessionId);
    if (!session) {
      this.warn("session", `Session not found: ${sessionId}`);
      return null;
    }

    session.endTime = Date.now();
    session.totalDuration = session.endTime - session.startTime;

    // Calculate summary statistics
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

    this.info(
      "session",
      `Session completed`,
      {
        sessionId,
        duration: session.totalDuration,
        summary: session.summary,
      },
      session.userId,
      sessionId
    );

    return session;
  }

  private addOperationToSession(
    sessionId: string,
    operation: {
      operation: string;
      startTime: number;
      endTime?: number;
      duration?: number;
      success: boolean;
      metadata?: Record<string, any>;
    }
  ): void {
    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      session.operations.push(operation);
    }
  }

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
    };

    const message = `Processing step '${stepName}' (${stepType}) for '${songTitle}' ${
      success ? "completed" : "failed"
    } in ${duration}ms`;

    if (success) {
      this.info("step-performance", message, stepMetadata, userId, sessionId);
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
  }

  logEnhancedDatabaseOperation(
    operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
    table: string,
    success: boolean,
    duration: number,
    options: {
      recordCount?: number;
      retryAttempt?: number;
      queryComplexity?: "simple" | "medium" | "complex";
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
      error,
      metadata: additionalMetadata,
    } = options;

    const dbMetadata = {
      operation,
      table,
      recordCount,
      duration,
      success,
      retryAttempt,
      queryComplexity,
      timestamp: new Date().toISOString(),
      error: error?.message,
      ...additionalMetadata,
    };

    const message = `Database ${operation} on ${table} ${
      success ? "completed" : "failed"
    } in ${duration}ms${retryAttempt > 0 ? ` (retry ${retryAttempt})` : ""}${
      recordCount ? ` (${recordCount} records)` : ""
    }`;

    if (success) {
      this.info("database-performance", message, dbMetadata, userId, sessionId);
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
  }
}

// Export singleton instance and convenience functions
export const serverLogger = ServerLogger.getInstance();

export function startSession(sessionId: string, userId: string): void {
  serverLogger.startSession(sessionId, userId);
}

export function endSession(sessionId: string): ServerSessionMetrics | null {
  return serverLogger.endSession(sessionId);
}

export function startPerformanceTimer(operationId: string): void {
  serverLogger.startPerformanceTimer(operationId);
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
  return serverLogger.endPerformanceTimer(
    operationId,
    category,
    operation,
    success,
    metadata,
    userId,
    sessionId
  );
}

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
  serverLogger.logProcessingStep(
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
    error?: Error;
    metadata?: Record<string, any>;
  } = {},
  userId?: string,
  sessionId?: string
): void {
  serverLogger.logEnhancedDatabaseOperation(
    operation,
    table,
    success,
    duration,
    options,
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
  const metadata = {
    table,
    recordCount,
    duration,
    success,
    error: error?.message,
  };

  if (success) {
    serverLogger.info(
      "database",
      `${operation} on ${table} completed successfully`,
      metadata,
      userId,
      sessionId
    );
  } else {
    serverLogger.error(
      "database",
      `${operation} on ${table} failed`,
      error,
      metadata,
      userId,
      sessionId
    );
  }
}
