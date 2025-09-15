"use client";

import * as React from "react";
import { EnhancedProgressDisplay } from "./enhanced-progress-display";
import { Button } from "./button";

interface ProgressData {
  type: string;
  current: number;
  total: number | string;
  percentage: number;
  step: string;
  song_title: string;
  timestamp: string;
  estimated_remaining_seconds?: number;
  estimated_remaining_minutes?: number;
  clips_completed?: number;
  successful?: number;
  failed?: number;
}

export function ProgressTest() {
  const [progress, setProgress] = React.useState<ProgressData>({
    type: "processing",
    current: 0,
    total: 10,
    percentage: 0,
    step: "준비 중...",
    song_title: "테스트를 시작합니다",
    timestamp: new Date().toISOString(),
    estimated_remaining_minutes: 5,
  });

  const [isRunning, setIsRunning] = React.useState(false);

  const simulateProgress = React.useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    let current = 0;
    const total = 10;
    const songs = [
      "BTS - Dynamite",
      "IU - Through the Night",
      "BLACKPINK - How You Like That",
      "NewJeans - Attention",
      "aespa - Next Level",
      "TWICE - What Is Love?",
      "Red Velvet - Psycho",
      "ITZY - WANNABE",
      "LE SSERAFIM - ANTIFRAGILE",
      "(G)I-DLE - Tomboy",
    ];

    const steps = [
      "다운로드 중...",
      "메타데이터 추출 중...",
      "클립 생성 중...",
      "품질 검사 중...",
      "저장 중...",
    ];

    const interval = setInterval(() => {
      if (current >= total) {
        clearInterval(interval);
        setProgress((prev) => ({
          ...prev,
          type: "completion",
          current: total,
          percentage: 100,
          step: "완료!",
          song_title: "모든 클립이 성공적으로 생성되었습니다",
          successful: total,
          failed: 0,
          estimated_remaining_minutes: 0,
        }));
        setIsRunning(false);
        return;
      }

      const stepIndex = Math.floor(Math.random() * steps.length);
      const songIndex = current % songs.length;
      const percentage = (current / total) * 100;
      const remainingMinutes = Math.max(0, (total - current) * 0.5);

      setProgress((prev) => ({
        ...prev,
        current: current + 1,
        percentage,
        step: steps[stepIndex],
        song_title: songs[songIndex],
        timestamp: new Date().toISOString(),
        estimated_remaining_minutes: remainingMinutes,
        clips_completed: current,
      }));

      current++;
    }, 1500); // Update every 1.5 seconds
  }, [isRunning]);

  const reset = () => {
    setProgress({
      type: "processing",
      current: 0,
      total: 10,
      percentage: 0,
      step: "준비 중...",
      song_title: "테스트를 시작합니다",
      timestamp: new Date().toISOString(),
      estimated_remaining_minutes: 5,
    });
    setIsRunning(false);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Progress UI Test</h2>
        <p className="text-muted-foreground">
          Enhanced progress display with animations and time estimation
        </p>
      </div>

      <EnhancedProgressDisplay
        progress={progress}
        showDetailedStats={true}
        showEstimatedTime={true}
        showCurrentSong={true}
        animated={true}
      />

      <div className="flex gap-2">
        <Button
          onClick={simulateProgress}
          disabled={isRunning}
          className="flex-1"
        >
          {isRunning ? "진행 중..." : "시뮬레이션 시작"}
        </Button>
        <Button onClick={reset} variant="outline" className="flex-1">
          리셋
        </Button>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <div>• 부드러운 진행률 애니메이션</div>
        <div>• 실시간 곡 정보 업데이트</div>
        <div>• 예상 완료 시간 계산</div>
        <div>• 처리 속도 통계</div>
        <div>• 시각적 피드백 및 애니메이션</div>
      </div>
    </div>
  );
}
