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
  };
};

// 로그 디렉토리 생성
async function ensureLogDirectory() {
  const { logsDir } = getLogFilePath();
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
  }
}

// 로그 엔트리를 파일에 기록
async function writeLogToFile(logEntry: LogEntry) {
  await ensureLogDirectory();

  const { errorLogPath, performanceLogPath, generalLogPath } = getLogFilePath();
  const logLine = JSON.stringify(logEntry) + "\n";

  try {
    // 로그 레벨에 따라 다른 파일에 기록
    switch (logEntry.level) {
      case "error":
        await appendFile(errorLogPath, logLine);
        break;
      case "performance":
        await appendFile(performanceLogPath, logLine);
        break;
      default:
        await appendFile(generalLogPath, logLine);
    }

    // 모든 로그는 일반 로그 파일에도 기록
    if (logEntry.level !== "debug") {
      await appendFile(generalLogPath, logLine);
    }
  } catch (error) {
    console.error("Failed to write log to file:", error);
  }
}

// 단일 로그 엔트리 처리
export async function POST(request: NextRequest) {
  try {
    const logEntry: LogEntry = await request.json();

    // 로그 유효성 검사
    if (
      !logEntry.timestamp ||
      !logEntry.level ||
      !logEntry.category ||
      !logEntry.message
    ) {
      return NextResponse.json(
        { error: "Invalid log entry format" },
        { status: 400 }
      );
    }

    // 서버 사이드 로깅
    console.log(
      `[${logEntry.level.toUpperCase()}] ${logEntry.category}: ${
        logEntry.message
      }`,
      logEntry.metadata || ""
    );

    // 파일에 로그 기록
    await writeLogToFile(logEntry);

    // 중요한 오류는 추가 처리
    if (logEntry.level === "error") {
      // 여기에 알림 시스템 연동 가능 (Slack, 이메일 등)
      console.error("CRITICAL ERROR LOGGED:", {
        message: logEntry.message,
        userId: logEntry.userId,
        sessionId: logEntry.sessionId,
        stackTrace: logEntry.stackTrace,
        metadata: logEntry.metadata,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing log entry:", error);
    return NextResponse.json(
      { error: "Failed to process log entry" },
      { status: 500 }
    );
  }
}

// 로그 조회 (개발/디버깅 용도)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];
    const level = searchParams.get("level");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "100");

    const { errorLogPath, performanceLogPath, generalLogPath } =
      getLogFilePath(date);

    let logFilePath = generalLogPath;
    if (level === "error") {
      logFilePath = errorLogPath;
    } else if (level === "performance") {
      logFilePath = performanceLogPath;
    }

    // 파일이 존재하지 않으면 빈 배열 반환
    if (!existsSync(logFilePath)) {
      return NextResponse.json({ logs: [] });
    }

    // 파일 읽기 (간단한 구현 - 실제로는 스트리밍 처리 권장)
    const fs = require("fs");
    const fileContent = fs.readFileSync(logFilePath, "utf-8");
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

    // 카테고리 필터링
    if (category) {
      logs = logs.filter((log) => log.category === category);
    }

    // 최신 로그부터 반환 (제한된 수량)
    logs = logs.slice(-limit).reverse();

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error retrieving logs:", error);
    return NextResponse.json(
      { error: "Failed to retrieve logs" },
      { status: 500 }
    );
  }
}
