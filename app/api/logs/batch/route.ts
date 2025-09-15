import { NextRequest, NextResponse } from "next/server";
import { writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  duration?: number;
  stackTrace?: string;
}

// 로그 파일 경로 설정
const getLogFilePath = (
  date: string = new Date().toISOString().split("T")[0]
) => {
  const logsDir = join(process.cwd(), "logs");
  return {
    logsDir,
    errorLogPath: join(logsDir, `error-${date}.log`),
    performanceLogPath: join(logsDir, `performance-${date}.log`),
    generalLogPath: join(logsDir, `general-${date}.log`),
    batchLogPath: join(logsDir, `batch-${date}.log`),
  };
};

// 로그 디렉토리 생성
async function ensureLogDirectory() {
  const { logsDir } = getLogFilePath();
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
  }
}

// 배치 로그 엔트리를 파일에 기록
async function writeBatchLogsToFile(logEntries: LogEntry[]): Promise<void> {
  await ensureLogDirectory();

  const { errorLogPath, performanceLogPath, generalLogPath, batchLogPath } =
    getLogFilePath();

  const errorLogs: string[] = [];
  const performanceLogs: string[] = [];
  const generalLogs: string[] = [];
  const allLogs: string[] = [];

  // 로그 레벨별로 분류
  for (const logEntry of logEntries) {
    const logLine = JSON.stringify(logEntry) + "\n";
    allLogs.push(logLine);

    switch (logEntry.level) {
      case "error":
        errorLogs.push(logLine);
        generalLogs.push(logLine);
        break;
      case "performance":
        performanceLogs.push(logLine);
        generalLogs.push(logLine);
        break;
      default:
        if (logEntry.level !== "debug") {
          generalLogs.push(logLine);
        }
    }
  }

  try {
    // 배치 로그 파일에 모든 로그 기록
    if (allLogs.length > 0) {
      await appendFile(batchLogPath, allLogs.join(""));
    }

    // 레벨별 로그 파일에 기록
    if (errorLogs.length > 0) {
      await appendFile(errorLogPath, errorLogs.join(""));
    }

    if (performanceLogs.length > 0) {
      await appendFile(performanceLogPath, performanceLogs.join(""));
    }

    if (generalLogs.length > 0) {
      await appendFile(generalLogPath, generalLogs.join(""));
    }

    console.log(
      `Batch logged ${logEntries.length} entries: ${errorLogs.length} errors, ${performanceLogs.length} performance`
    );
  } catch (error) {
    console.error("Failed to write batch logs to file:", error);
  }
}

// 배치 로그 처리
export async function POST(request: NextRequest) {
  try {
    const logEntries: LogEntry[] = await request.json();

    // 로그 배열 유효성 검사
    if (!Array.isArray(logEntries) || logEntries.length === 0) {
      return NextResponse.json(
        { error: "Invalid log entries format - expected non-empty array" },
        { status: 400 }
      );
    }

    // 각 로그 엔트리 유효성 검사
    const validLogEntries: LogEntry[] = [];
    const invalidEntries: any[] = [];

    for (const logEntry of logEntries) {
      if (
        logEntry.timestamp &&
        logEntry.level &&
        logEntry.category &&
        logEntry.message
      ) {
        validLogEntries.push(logEntry);
      } else {
        invalidEntries.push(logEntry);
      }
    }

    if (invalidEntries.length > 0) {
      console.warn(
        `${invalidEntries.length} invalid log entries ignored in batch`
      );
    }

    if (validLogEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid log entries found in batch" },
        { status: 400 }
      );
    }

    // 서버 사이드 로깅 (요약)
    const logSummary = validLogEntries.reduce((summary, log) => {
      summary[log.level] = (summary[log.level] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);

    console.log(
      `Batch processing ${validLogEntries.length} log entries:`,
      logSummary
    );

    // 파일에 배치 로그 기록
    await writeBatchLogsToFile(validLogEntries);

    // 중요한 오류들 별도 처리
    const criticalErrors = validLogEntries.filter(
      (log) => log.level === "error"
    );
    if (criticalErrors.length > 0) {
      console.error(
        `CRITICAL: ${criticalErrors.length} errors in batch:`,
        criticalErrors.map((e) => ({
          message: e.message,
          category: e.category,
          userId: e.userId,
          sessionId: e.sessionId,
        }))
      );
    }

    // 성능 이슈들 별도 처리
    const performanceIssues = validLogEntries.filter(
      (log) => log.level === "performance" && log.metadata?.performanceIssue
    );

    if (performanceIssues.length > 0) {
      console.warn(
        `PERFORMANCE: ${performanceIssues.length} performance issues in batch:`,
        performanceIssues.map((p) => ({
          message: p.message,
          issue: p.metadata?.performanceIssue,
          duration: p.duration,
          userId: p.userId,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      processed: validLogEntries.length,
      invalid: invalidEntries.length,
      summary: logSummary,
    });
  } catch (error) {
    console.error("Error processing batch log entries:", error);
    return NextResponse.json(
      { error: "Failed to process batch log entries" },
      { status: 500 }
    );
  }
}

// 배치 로그 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];
    const level = searchParams.get("level");
    const category = searchParams.get("category");
    const userId = searchParams.get("userId");
    const sessionId = searchParams.get("sessionId");
    const limit = parseInt(searchParams.get("limit") || "1000");

    const { batchLogPath } = getLogFilePath(date);

    // 파일이 존재하지 않으면 빈 배열 반환
    if (!existsSync(batchLogPath)) {
      return NextResponse.json({ logs: [] });
    }

    // 파일 읽기
    const fs = require("fs");
    const fileContent = fs.readFileSync(batchLogPath, "utf-8");
    const lines = fileContent
      .trim()
      .split("\n")
      .filter((line) => line);

    let logs = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((log) => log !== null);

    // 필터링
    if (level) {
      logs = logs.filter((log) => log.level === level);
    }

    if (category) {
      logs = logs.filter((log) => log.category === category);
    }

    if (userId) {
      logs = logs.filter((log) => log.userId === userId);
    }

    if (sessionId) {
      logs = logs.filter((log) => log.sessionId === sessionId);
    }

    // 최신 로그부터 반환 (제한된 수량)
    logs = logs.slice(-limit).reverse();

    // 통계 정보 추가
    const stats = {
      total: logs.length,
      by_level: logs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_category: logs.reduce((acc, log) => {
        acc[log.category] = (acc[log.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      date_range: {
        earliest: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
        latest: logs.length > 0 ? logs[0].timestamp : null,
      },
    };

    return NextResponse.json({
      logs,
      stats,
      filters: {
        date,
        level,
        category,
        userId,
        sessionId,
        limit,
      },
    });
  } catch (error) {
    console.error("Error retrieving batch logs:", error);
    return NextResponse.json(
      { error: "Failed to retrieve batch logs" },
      { status: 500 }
    );
  }
}
