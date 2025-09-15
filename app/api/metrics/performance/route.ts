import { NextRequest, NextResponse } from "next/server";
import { writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

interface StepPerformance {
  step_name: string;
  step_type:
    | "download"
    | "clip_generation"
    | "metadata_extraction"
    | "database_save"
    | "file_cleanup";
  song_title: string;
  start_time: number;
  end_time?: number;
  duration?: number;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

interface SessionPerformance {
  session_id: string;
  user_id: string;
  start_time: number;
  end_time?: number;
  total_duration?: number;
  steps: StepPerformance[];
  summary?: {
    total_steps: number;
    successful_steps: number;
    failed_steps: number;
    success_rate: number;
    failure_rate: number;
    average_step_time: number;
    total_processing_time: number;
    step_type_breakdown: Record<
      string,
      {
        count: number;
        successful: number;
        failed: number;
        total_duration: number;
        average_duration: number;
        min_duration: number;
        max_duration: number;
      }
    >;
    performance_issues: Array<{
      type: string;
      step_type?: string;
      average_duration?: number;
      threshold?: number;
      count?: number;
      failure_rate?: number;
      failed_steps?: number;
      total_steps?: number;
    }>;
  };
}

interface PerformanceAnalysis {
  session_id: string;
  user_id: string;
  analysis_timestamp: string;
  overall_performance: {
    grade: "excellent" | "good" | "fair" | "poor";
    score: number;
    total_duration: number;
    efficiency_rating: number;
  };
  step_analysis: Record<
    string,
    {
      performance_grade: "excellent" | "good" | "fair" | "poor";
      average_duration: number;
      success_rate: number;
      recommendations: string[];
    }
  >;
  bottlenecks: Array<{
    step_type: string;
    severity: "low" | "medium" | "high";
    description: string;
    impact: string;
    recommendation: string;
  }>;
  trends: {
    performance_trend: "improving" | "stable" | "degrading";
    failure_trend: "improving" | "stable" | "degrading";
    efficiency_trend: "improving" | "stable" | "degrading";
  };
}

// 성능 메트릭 파일 경로 설정
const getPerformanceMetricsPath = (
  date: string = new Date().toISOString().split("T")[0]
) => {
  const metricsDir = join(process.cwd(), "metrics", "performance");
  return {
    metricsDir,
    sessionPerformancePath: join(
      metricsDir,
      `session-performance-${date}.jsonl`
    ),
    stepPerformancePath: join(metricsDir, `step-performance-${date}.jsonl`),
    analysisPath: join(metricsDir, `performance-analysis-${date}.jsonl`),
    summaryPath: join(metricsDir, `performance-summary-${date}.json`),
  };
};

// 메트릭 디렉토리 생성
async function ensurePerformanceMetricsDirectory() {
  const { metricsDir } = getPerformanceMetricsPath();
  if (!existsSync(metricsDir)) {
    await mkdir(metricsDir, { recursive: true });
  }
}

// 성능 분석 수행
function analyzeSessionPerformance(
  session: SessionPerformance
): PerformanceAnalysis {
  const steps = session.steps || [];
  const summary = session.summary;

  if (!summary) {
    throw new Error("Session summary is required for analysis");
  }

  // 전체 성능 등급 계산
  const calculateOverallGrade = (): {
    grade: "excellent" | "good" | "fair" | "poor";
    score: number;
  } => {
    let score = 100;

    // 성공률 기반 점수 (40점 만점)
    const successRateScore = summary.success_rate * 40;

    // 속도 기반 점수 (30점 만점)
    const avgStepTime = summary.average_step_time;
    let speedScore = 30;
    if (avgStepTime > 10000) speedScore = 10; // 10초 이상
    else if (avgStepTime > 5000) speedScore = 20; // 5-10초
    else if (avgStepTime > 2000) speedScore = 25; // 2-5초

    // 안정성 기반 점수 (30점 만점)
    const issueCount = summary.performance_issues?.length || 0;
    let stabilityScore = 30;
    if (issueCount > 5) stabilityScore = 10;
    else if (issueCount > 3) stabilityScore = 20;
    else if (issueCount > 1) stabilityScore = 25;

    score = successRateScore + speedScore + stabilityScore;

    let grade: "excellent" | "good" | "fair" | "poor";
    if (score >= 90) grade = "excellent";
    else if (score >= 75) grade = "good";
    else if (score >= 60) grade = "fair";
    else grade = "poor";

    return { grade, score };
  };

  // 단계별 분석
  const analyzeStepTypes = (): Record<
    string,
    {
      performance_grade: "excellent" | "good" | "fair" | "poor";
      average_duration: number;
      success_rate: number;
      recommendations: string[];
    }
  > => {
    const stepAnalysis: Record<string, any> = {};

    for (const [stepType, breakdown] of Object.entries(
      summary.step_type_breakdown
    )) {
      const successRate = breakdown.successful / breakdown.count;
      const avgDuration = breakdown.average_duration;

      let grade: "excellent" | "good" | "fair" | "poor";
      const recommendations: string[] = [];

      // 단계별 임계값
      const thresholds = {
        download: { excellent: 15000, good: 25000, fair: 35000 },
        clip_generation: { excellent: 2000, good: 4000, fair: 6000 },
        metadata_extraction: { excellent: 500, good: 1000, fair: 2000 },
        database_save: { excellent: 1000, good: 2000, fair: 4000 },
        file_cleanup: { excellent: 500, good: 1000, fair: 2000 },
      };

      const threshold =
        thresholds[stepType as keyof typeof thresholds] ||
        thresholds.clip_generation;

      if (successRate >= 0.95 && avgDuration <= threshold.excellent) {
        grade = "excellent";
      } else if (successRate >= 0.9 && avgDuration <= threshold.good) {
        grade = "good";
      } else if (successRate >= 0.8 && avgDuration <= threshold.fair) {
        grade = "fair";
      } else {
        grade = "poor";
      }

      // 추천사항 생성
      if (successRate < 0.9) {
        recommendations.push(
          `${stepType} 단계의 성공률이 낮습니다 (${Math.round(
            successRate * 100
          )}%). 오류 원인을 분석하세요.`
        );
      }

      if (avgDuration > threshold.fair) {
        recommendations.push(
          `${stepType} 단계가 느립니다 (평균 ${Math.round(
            avgDuration
          )}ms). 성능 최적화가 필요합니다.`
        );
      }

      if (breakdown.failed > 0) {
        recommendations.push(
          `${breakdown.failed}개의 ${stepType} 작업이 실패했습니다. 재시도 메커니즘을 확인하세요.`
        );
      }

      stepAnalysis[stepType] = {
        performance_grade: grade,
        average_duration: avgDuration,
        success_rate: successRate,
        recommendations,
      };
    }

    return stepAnalysis;
  };

  // 병목 지점 식별
  const identifyBottlenecks = (): Array<{
    step_type: string;
    severity: "low" | "medium" | "high";
    description: string;
    impact: string;
    recommendation: string;
  }> => {
    const bottlenecks: Array<any> = [];

    for (const issue of summary.performance_issues || []) {
      let severity: "low" | "medium" | "high" = "low";
      let impact = "";
      let recommendation = "";

      if (issue.type === "slow_operation") {
        const avgDuration = issue.average_duration || 0;
        const threshold = issue.threshold || 5000;

        if (avgDuration > threshold * 3) {
          severity = "high";
          impact = "전체 처리 시간을 크게 지연시킵니다";
          recommendation = "즉시 성능 최적화가 필요합니다";
        } else if (avgDuration > threshold * 2) {
          severity = "medium";
          impact = "처리 시간에 영향을 줍니다";
          recommendation = "성능 개선을 고려하세요";
        } else {
          severity = "low";
          impact = "약간의 지연을 발생시킵니다";
          recommendation = "모니터링을 계속하세요";
        }

        bottlenecks.push({
          step_type: issue.step_type || "unknown",
          severity,
          description: `${issue.step_type} 단계가 평균 ${Math.round(
            avgDuration
          )}ms로 임계값(${threshold}ms)을 초과합니다`,
          impact,
          recommendation,
        });
      }

      if (issue.type === "high_failure_rate") {
        const failureRate = issue.failure_rate || 0;

        if (failureRate > 0.5) {
          severity = "high";
          impact = "시스템 안정성에 심각한 영향을 줍니다";
          recommendation = "즉시 오류 원인을 파악하고 수정하세요";
        } else if (failureRate > 0.3) {
          severity = "medium";
          impact = "시스템 신뢰성을 저하시킵니다";
          recommendation = "오류 처리 로직을 개선하세요";
        } else {
          severity = "low";
          impact = "간헐적인 오류가 발생합니다";
          recommendation = "오류 패턴을 모니터링하세요";
        }

        bottlenecks.push({
          step_type: "overall",
          severity,
          description: `전체 실패율이 ${Math.round(
            failureRate * 100
          )}%로 높습니다`,
          impact,
          recommendation,
        });
      }
    }

    return bottlenecks;
  };

  const overallPerformance = calculateOverallGrade();
  const stepAnalysis = analyzeStepTypes();
  const bottlenecks = identifyBottlenecks();

  // 효율성 등급 계산
  const totalDuration = session.total_duration || 0;
  const totalSteps = summary.total_steps;
  const efficiencyRating =
    totalSteps > 0 ? Math.max(0, 100 - totalDuration / 1000 / totalSteps) : 0;

  return {
    session_id: session.session_id,
    user_id: session.user_id,
    analysis_timestamp: new Date().toISOString(),
    overall_performance: {
      grade: overallPerformance.grade,
      score: overallPerformance.score,
      total_duration: totalDuration,
      efficiency_rating: efficiencyRating,
    },
    step_analysis: stepAnalysis,
    bottlenecks,
    trends: {
      performance_trend: "stable", // 향후 히스토리 데이터로 계산
      failure_trend: "stable",
      efficiency_trend: "stable",
    },
  };
}

// 세션 성능 메트릭 저장
export async function POST(request: NextRequest) {
  try {
    const sessionPerformance: SessionPerformance = await request.json();

    // 성능 메트릭 유효성 검사
    if (
      !sessionPerformance.session_id ||
      !sessionPerformance.user_id ||
      !sessionPerformance.start_time
    ) {
      return NextResponse.json(
        { error: "Invalid session performance format" },
        { status: 400 }
      );
    }

    await ensurePerformanceMetricsDirectory();

    const { sessionPerformancePath, stepPerformancePath, analysisPath } =
      getPerformanceMetricsPath();

    // 세션 성능 메트릭 저장
    const sessionLogEntry = {
      ...sessionPerformance,
      recorded_at: new Date().toISOString(),
    };

    await appendFile(
      sessionPerformancePath,
      JSON.stringify(sessionLogEntry) + "\n"
    );

    // 개별 단계 성능 메트릭 저장
    for (const step of sessionPerformance.steps || []) {
      const stepEntry = {
        session_id: sessionPerformance.session_id,
        user_id: sessionPerformance.user_id,
        timestamp: new Date(step.start_time * 1000).toISOString(),
        ...step,
      };

      await appendFile(stepPerformancePath, JSON.stringify(stepEntry) + "\n");
    }

    // 성능 분석 수행 및 저장
    if (sessionPerformance.summary) {
      try {
        const analysis = analyzeSessionPerformance(sessionPerformance);

        await appendFile(analysisPath, JSON.stringify(analysis) + "\n");

        console.log(
          `Performance analysis completed for session ${sessionPerformance.session_id}:`,
          {
            overall_grade: analysis.overall_performance.grade,
            score: analysis.overall_performance.score,
            bottlenecks: analysis.bottlenecks.length,
            efficiency: Math.round(
              analysis.overall_performance.efficiency_rating
            ),
          }
        );

        // 성능 이슈가 심각한 경우 경고
        const highSeverityBottlenecks = analysis.bottlenecks.filter(
          (b) => b.severity === "high"
        );
        if (highSeverityBottlenecks.length > 0) {
          console.warn(
            `High severity performance issues detected in session ${sessionPerformance.session_id}:`,
            highSeverityBottlenecks.map((b) => b.description)
          );
        }
      } catch (analysisError) {
        console.error("Failed to analyze session performance:", analysisError);
      }
    }

    // 서버 콘솔에 요약 출력
    console.log(
      `Session performance metrics recorded: ${sessionPerformance.session_id}`,
      {
        user_id: sessionPerformance.user_id,
        total_duration: sessionPerformance.total_duration,
        total_steps: sessionPerformance.summary?.total_steps || 0,
        success_rate: Math.round(
          (sessionPerformance.summary?.success_rate || 0) * 100
        ),
        performance_issues:
          sessionPerformance.summary?.performance_issues?.length || 0,
      }
    );

    return NextResponse.json({
      success: true,
      analysis_performed: !!sessionPerformance.summary,
    });
  } catch (error) {
    console.error("Error processing session performance metrics:", error);
    return NextResponse.json(
      { error: "Failed to process session performance metrics" },
      { status: 500 }
    );
  }
}

// 성능 메트릭 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];
    const type = searchParams.get("type") || "summary"; // summary, sessions, steps, analysis
    const sessionId = searchParams.get("sessionId");

    const { sessionPerformancePath, stepPerformancePath, analysisPath } =
      getPerformanceMetricsPath(date);

    let filePath = sessionPerformancePath;
    if (type === "steps") {
      filePath = stepPerformancePath;
    } else if (type === "analysis") {
      filePath = analysisPath;
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({
        data: null,
        message: "No performance data found for the specified date",
      });
    }

    // JSONL 파일 읽기
    const content = require("fs").readFileSync(filePath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line);

    let data = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((item) => item !== null);

    // 특정 세션 필터링
    if (sessionId) {
      data = data.filter((item) => item.session_id === sessionId);
    }

    // 요약 통계 생성 (type이 summary인 경우)
    if (type === "summary") {
      const sessions = data;
      const summary = {
        date,
        total_sessions: sessions.length,
        total_steps: sessions.reduce(
          (sum, s) => sum + (s.summary?.total_steps || 0),
          0
        ),
        average_success_rate:
          sessions.length > 0
            ? sessions.reduce(
                (sum, s) => sum + (s.summary?.success_rate || 0),
                0
              ) / sessions.length
            : 0,
        average_session_duration:
          sessions.length > 0
            ? sessions.reduce((sum, s) => sum + (s.total_duration || 0), 0) /
              sessions.length
            : 0,
        performance_issues_count: sessions.reduce(
          (sum, s) => sum + (s.summary?.performance_issues?.length || 0),
          0
        ),
        step_type_performance: {} as Record<string, any>,
      };

      // 단계별 성능 요약
      const allStepBreakdowns = sessions
        .map((s) => s.summary?.step_type_breakdown)
        .filter(Boolean);

      if (allStepBreakdowns.length > 0) {
        const stepTypes = new Set<string>();
        allStepBreakdowns.forEach((breakdown) => {
          Object.keys(breakdown).forEach((stepType) => stepTypes.add(stepType));
        });

        for (const stepType of stepTypes) {
          const stepData = allStepBreakdowns
            .map((breakdown) => breakdown[stepType])
            .filter(Boolean);

          if (stepData.length > 0) {
            summary.step_type_performance[stepType] = {
              total_operations: stepData.reduce((sum, d) => sum + d.count, 0),
              average_duration:
                stepData.reduce((sum, d) => sum + d.average_duration, 0) /
                stepData.length,
              success_rate:
                stepData.reduce((sum, d) => sum + d.successful / d.count, 0) /
                stepData.length,
            };
          }
        }
      }

      return NextResponse.json({ data: summary });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error retrieving performance metrics:", error);
    return NextResponse.json(
      { error: "Failed to retrieve performance metrics" },
      { status: 500 }
    );
  }
}
