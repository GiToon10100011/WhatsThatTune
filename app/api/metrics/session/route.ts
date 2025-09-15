import { NextRequest, NextResponse } from "next/server";
import { writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
  error?: string;
}

interface SessionMetrics {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  operations: PerformanceMetric[];
  errors: any[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    totalProcessingTime: number;
  };
}

// 메트릭 파일 경로 설정
const getMetricsFilePath = (
  date: string = new Date().toISOString().split("T")[0]
) => {
  const metricsDir = join(process.cwd(), "metrics");
  return {
    metricsDir,
    sessionMetricsPath: join(metricsDir, `sessions-${date}.json`),
    performanceMetricsPath: join(metricsDir, `performance-${date}.json`),
    summaryPath: join(metricsDir, `summary-${date}.json`),
  };
};

// 메트릭 디렉토리 생성
async function ensureMetricsDirectory() {
  const { metricsDir } = getMetricsFilePath();
  if (!existsSync(metricsDir)) {
    await mkdir(metricsDir, { recursive: true });
  }
}

// 세션 메트릭 저장
export async function POST(request: NextRequest) {
  try {
    const sessionMetrics: SessionMetrics = await request.json();

    // 메트릭 유효성 검사
    if (
      !sessionMetrics.sessionId ||
      !sessionMetrics.userId ||
      !sessionMetrics.startTime
    ) {
      return NextResponse.json(
        { error: "Invalid session metrics format" },
        { status: 400 }
      );
    }

    await ensureMetricsDirectory();

    const { sessionMetricsPath, performanceMetricsPath, summaryPath } =
      getMetricsFilePath();

    // 세션 메트릭을 파일에 추가
    const sessionLogEntry = {
      ...sessionMetrics,
      recordedAt: new Date().toISOString(),
    };

    await appendFile(
      sessionMetricsPath,
      JSON.stringify(sessionLogEntry) + "\n"
    );

    // 개별 성능 메트릭 추출 및 저장
    for (const operation of sessionMetrics.operations) {
      const performanceEntry = {
        sessionId: sessionMetrics.sessionId,
        userId: sessionMetrics.userId,
        timestamp: new Date(operation.startTime).toISOString(),
        ...operation,
      };

      await appendFile(
        performanceMetricsPath,
        JSON.stringify(performanceEntry) + "\n"
      );
    }

    // 일일 요약 통계 업데이트
    await updateDailySummary(sessionMetrics);

    // 서버 콘솔에 요약 출력
    console.log(`Session metrics recorded: ${sessionMetrics.sessionId}`, {
      userId: sessionMetrics.userId,
      duration: sessionMetrics.totalDuration,
      operations: sessionMetrics.summary.totalOperations,
      success: sessionMetrics.summary.successfulOperations,
      failures: sessionMetrics.summary.failedOperations,
      avgTime: Math.round(sessionMetrics.summary.averageOperationTime),
    });

    // 성능 이상 감지
    const performanceIssues = detectPerformanceIssues(sessionMetrics);
    if (performanceIssues.length > 0) {
      console.warn(
        `Performance issues detected in session ${sessionMetrics.sessionId}:`,
        performanceIssues
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing session metrics:", error);
    return NextResponse.json(
      { error: "Failed to process session metrics" },
      { status: 500 }
    );
  }
}

// 일일 요약 통계 업데이트
async function updateDailySummary(sessionMetrics: SessionMetrics) {
  try {
    const { summaryPath } = getMetricsFilePath();

    let dailySummary = {
      date: new Date().toISOString().split("T")[0],
      totalSessions: 0,
      totalUsers: new Set<string>(),
      totalOperations: 0,
      totalSuccessfulOperations: 0,
      totalFailedOperations: 0,
      totalProcessingTime: 0,
      averageSessionDuration: 0,
      averageOperationTime: 0,
      performanceIssues: 0,
      lastUpdated: new Date().toISOString(),
    };

    // 기존 요약 파일이 있으면 로드
    if (existsSync(summaryPath)) {
      try {
        const existingContent = require("fs").readFileSync(
          summaryPath,
          "utf-8"
        );
        const existing = JSON.parse(existingContent);
        dailySummary = {
          ...dailySummary,
          ...existing,
          totalUsers: new Set(existing.totalUsers || []),
        };
      } catch (error) {
        console.warn("Failed to load existing summary, creating new one");
      }
    }

    // 새 세션 데이터 추가
    dailySummary.totalSessions += 1;
    dailySummary.totalUsers.add(sessionMetrics.userId);
    dailySummary.totalOperations += sessionMetrics.summary.totalOperations;
    dailySummary.totalSuccessfulOperations +=
      sessionMetrics.summary.successfulOperations;
    dailySummary.totalFailedOperations +=
      sessionMetrics.summary.failedOperations;
    dailySummary.totalProcessingTime +=
      sessionMetrics.summary.totalProcessingTime;

    // 평균 계산
    dailySummary.averageSessionDuration = sessionMetrics.totalDuration
      ? (dailySummary.averageSessionDuration *
          (dailySummary.totalSessions - 1) +
          sessionMetrics.totalDuration) /
        dailySummary.totalSessions
      : dailySummary.averageSessionDuration;

    dailySummary.averageOperationTime =
      dailySummary.totalOperations > 0
        ? dailySummary.totalProcessingTime / dailySummary.totalOperations
        : 0;

    // 성능 이슈 카운트
    const issues = detectPerformanceIssues(sessionMetrics);
    dailySummary.performanceIssues += issues.length;

    dailySummary.lastUpdated = new Date().toISOString();

    // Set을 배열로 변환하여 저장
    const summaryToSave = {
      ...dailySummary,
      totalUsers: Array.from(dailySummary.totalUsers),
      uniqueUserCount: dailySummary.totalUsers.size,
    };

    await writeFile(summaryPath, JSON.stringify(summaryToSave, null, 2));
  } catch (error) {
    console.error("Failed to update daily summary:", error);
  }
}

// 성능 이슈 감지
function detectPerformanceIssues(sessionMetrics: SessionMetrics): string[] {
  const issues: string[] = [];

  // 세션 전체 시간이 너무 긴 경우 (30분 이상)
  if (
    sessionMetrics.totalDuration &&
    sessionMetrics.totalDuration > 30 * 60 * 1000
  ) {
    issues.push(
      `Long session duration: ${Math.round(
        sessionMetrics.totalDuration / 1000 / 60
      )}min`
    );
  }

  // 실패율이 높은 경우 (50% 이상)
  const failureRate =
    sessionMetrics.summary.totalOperations > 0
      ? sessionMetrics.summary.failedOperations /
        sessionMetrics.summary.totalOperations
      : 0;

  if (failureRate > 0.5) {
    issues.push(`High failure rate: ${Math.round(failureRate * 100)}%`);
  }

  // 평균 작업 시간이 너무 긴 경우 (5분 이상)
  if (sessionMetrics.summary.averageOperationTime > 5 * 60 * 1000) {
    issues.push(
      `Slow operations: avg ${Math.round(
        sessionMetrics.summary.averageOperationTime / 1000
      )}s`
    );
  }

  // 특정 작업이 너무 오래 걸리는 경우
  const slowOperations = sessionMetrics.operations.filter(
    (op) => op.duration && op.duration > 10 * 60 * 1000 // 10분 이상
  );

  if (slowOperations.length > 0) {
    issues.push(`${slowOperations.length} operations took >10min`);
  }

  // 연속된 실패가 많은 경우
  let consecutiveFailures = 0;
  let maxConsecutiveFailures = 0;

  for (const operation of sessionMetrics.operations) {
    if (!operation.success) {
      consecutiveFailures++;
      maxConsecutiveFailures = Math.max(
        maxConsecutiveFailures,
        consecutiveFailures
      );
    } else {
      consecutiveFailures = 0;
    }
  }

  if (maxConsecutiveFailures >= 3) {
    issues.push(`${maxConsecutiveFailures} consecutive failures`);
  }

  return issues;
}

// 메트릭 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];
    const type = searchParams.get("type") || "summary"; // summary, sessions, performance

    const { sessionMetricsPath, performanceMetricsPath, summaryPath } =
      getMetricsFilePath(date);

    let filePath = summaryPath;
    if (type === "sessions") {
      filePath = sessionMetricsPath;
    } else if (type === "performance") {
      filePath = performanceMetricsPath;
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({
        data: null,
        message: "No data found for the specified date",
      });
    }

    if (type === "summary") {
      // 요약 데이터는 JSON 파일
      const content = require("fs").readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      return NextResponse.json({ data });
    } else {
      // 세션/성능 데이터는 JSONL 파일
      const content = require("fs").readFileSync(filePath, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line);
      const data = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((item) => item !== null);

      return NextResponse.json({ data });
    }
  } catch (error) {
    console.error("Error retrieving metrics:", error);
    return NextResponse.json(
      { error: "Failed to retrieve metrics" },
      { status: 500 }
    );
  }
}
