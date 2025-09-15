"use client";

import * as React from "react";
import { Progress } from "./progress";
import { cn } from "@/lib/utils";
import {
  Clock,
  Music,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import {
  useSmoothProgress,
  easingFunctions,
} from "@/lib/hooks/useSmoothProgress";

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
  // Enhanced progress tracking fields
  current_video_title?: string;
  processing_stage?: string;
  completed_videos?: Array<{
    title: string;
    status: "success" | "failed";
    error?: string;
  }>;
  remaining_count?: number;
  active_workers?: Array<{
    video_title: string;
    stage: string;
  }>;
}

interface EnhancedProgressDisplayProps {
  progress: ProgressData;
  className?: string;
  showDetailedStats?: boolean;
  showEstimatedTime?: boolean;
  showCurrentSong?: boolean;
  animated?: boolean;
}

export function EnhancedProgressDisplay({
  progress,
  className,
  showDetailedStats = true,
  showEstimatedTime = true,
  showCurrentSong = true,
  animated = true,
}: EnhancedProgressDisplayProps) {
  const [averageTimePerClip, setAverageTimePerClip] = React.useState<
    number | null
  >(null);
  const [processingRate, setProcessingRate] = React.useState<number | null>(
    null
  );
  const [lastSongTitle, setLastSongTitle] = React.useState<string>("");
  const [songChanged, setSongChanged] = React.useState(false);
  const startTimeRef = React.useRef<Date | null>(null);

  // Smooth progress animation
  const smoothProgress = useSmoothProgress({
    duration: 800,
    easing: easingFunctions.easeOutCubic,
    threshold: 0.1,
    onUpdate: (value) => {
      // Optional: Add any side effects during animation
    },
    onComplete: () => {
      // Optional: Add completion effects
    },
  });

  // Handle song changes with animation
  React.useEffect(() => {
    if (progress.song_title !== lastSongTitle && lastSongTitle !== "") {
      setSongChanged(true);
      setTimeout(() => setSongChanged(false), 400);
    }
    setLastSongTitle(progress.song_title);
  }, [progress.song_title, lastSongTitle]);

  // Update smooth progress animation
  React.useEffect(() => {
    if (animated && typeof progress.total === "number") {
      smoothProgress.animateTo(progress.percentage);
    }
  }, [progress.percentage, animated, smoothProgress]);

  // Calculate processing statistics
  React.useEffect(() => {
    if (!startTimeRef.current && progress.current > 0) {
      startTimeRef.current = new Date();
    }

    if (startTimeRef.current && progress.current > 0) {
      const elapsedMinutes =
        (Date.now() - startTimeRef.current.getTime()) / (1000 * 60);
      const rate = progress.current / elapsedMinutes;
      setProcessingRate(rate);

      if (progress.current > 1) {
        setAverageTimePerClip(elapsedMinutes / progress.current);
      }
    }
  }, [progress.current]);

  // Format time display
  const formatTime = (minutes: number): string => {
    if (minutes < 1) return "1분 미만";
    if (minutes < 60) return `약 ${Math.ceil(minutes)}분`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.ceil(minutes % 60);
    return `약 ${hours}시간 ${remainingMinutes}분`;
  };

  // Calculate more accurate estimated time
  const getEstimatedTime = (): string | null => {
    if (typeof progress.total === "string") return null;

    // Use provided estimate if available
    if (progress.estimated_remaining_minutes !== undefined) {
      return formatTime(progress.estimated_remaining_minutes);
    }

    // Calculate based on current processing rate
    if (averageTimePerClip && progress.total > progress.current) {
      const remainingClips = progress.total - progress.current;
      const estimatedMinutes = remainingClips * averageTimePerClip;
      return formatTime(estimatedMinutes);
    }

    return null;
  };

  // Get progress color based on status
  const getProgressColor = () => {
    if (progress.failed && progress.failed > 0) {
      return "from-orange-500 to-red-500";
    }
    if (progress.percentage > 80) {
      return "from-green-500 to-emerald-500";
    }
    if (progress.percentage > 50) {
      return "from-blue-500 to-cyan-500";
    }
    return "from-blue-500 to-purple-500";
  };

  const isIndeterminate = typeof progress.total === "string";
  const estimatedTime = getEstimatedTime();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {progress.current}
              {!isIndeterminate && `/${progress.total}`} 곡
            </span>
            {isIndeterminate && (
              <span className="text-xs text-muted-foreground">
                (총 개수 분석 중)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isIndeterminate && (
              <span className="font-mono text-sm">
                {progress.percentage.toFixed(1)}%
              </span>
            )}
            {progress.successful !== undefined &&
              progress.failed !== undefined && (
                <div className="flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>{progress.successful}</span>
                  {progress.failed > 0 && (
                    <>
                      <AlertCircle className="h-3 w-3 text-orange-500 ml-1" />
                      <span>{progress.failed}</span>
                    </>
                  )}
                </div>
              )}
          </div>
        </div>

        <Progress
          value={
            isIndeterminate
              ? undefined
              : animated
              ? smoothProgress.value
              : progress.percentage
          }
          animated={animated}
          showGradient={true}
          pulseOnUpdate={smoothProgress.isAnimating}
          className="h-3"
        />
      </div>

      {/* Current Song Information - Enhanced */}
      {showCurrentSong && (
        <div
          className={cn(
            "flex flex-col gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800 transition-all duration-300",
            songChanged &&
              "song-info-animation border-green-400 dark:border-green-600"
          )}
        >
          {/* Processing Stage */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Music
                className={cn(
                  "h-6 w-6 text-blue-600 dark:text-blue-400",
                  smoothProgress.isAnimating
                    ? "animate-pulse"
                    : "animate-bounce"
                )}
              />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-base text-blue-800 dark:text-blue-200">
                {progress.processing_stage || progress.step}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {processingRate && (
                <div
                  className={cn(
                    "text-xs text-muted-foreground transition-all duration-300 px-2 py-1 bg-white/50 dark:bg-black/20 rounded-full",
                    processingRate > 2 && "text-green-600 stats-bounce"
                  )}
                >
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  {processingRate.toFixed(1)}/분
                </div>
              )}
              {smoothProgress.isAnimating && (
                <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
              )}
            </div>
          </div>

          {/* Current Video Title */}
          <div className="pl-9">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
              현재 처리 중인 영상:
            </div>
            <div
              className={cn(
                "text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed transition-all duration-300",
                songChanged &&
                  "text-green-600 dark:text-green-400 font-semibold"
              )}
              title={progress.current_video_title || progress.song_title} // 전체 제목을 툴팁으로 표시
            >
              {progress.current_video_title ||
                progress.song_title ||
                "제목을 가져오는 중..."}
            </div>
          </div>

          {/* Active Workers Display (for parallel processing) */}
          {progress.active_workers && progress.active_workers.length > 0 && (
            <div className="pl-9 border-t border-blue-200 dark:border-blue-700 pt-2">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
                동시 처리 중인 영상들:
              </div>
              <div className="space-y-1">
                {progress.active_workers.slice(0, 3).map((worker, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                      {worker.video_title}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {worker.stage}
                    </span>
                  </div>
                ))}
                {progress.active_workers.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{progress.active_workers.length - 3}개 더...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remaining Count Display */}
          {progress.remaining_count !== undefined &&
            progress.remaining_count > 0 && (
              <div className="pl-9 border-t border-blue-200 dark:border-blue-700 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>남은 영상: {progress.remaining_count}개</span>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Estimated Time and Statistics */}
      {showEstimatedTime && estimatedTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>예상 남은 시간: {estimatedTime}</span>
        </div>
      )}

      {/* Completed Videos List */}
      {progress.completed_videos && progress.completed_videos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              완료된 영상들
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {progress.completed_videos.length}개 완료
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-900/50 rounded-md p-2">
            {progress.completed_videos.slice(-5).map((video, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                {video.status === "success" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "truncate flex-1",
                    video.status === "success"
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-red-600 dark:text-red-400"
                  )}
                  title={
                    video.error
                      ? `${video.title} - ${video.error}`
                      : video.title
                  }
                >
                  {video.title}
                </span>
              </div>
            ))}
            {progress.completed_videos.length > 5 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1 border-t border-gray-200 dark:border-gray-700">
                +{progress.completed_videos.length - 5}개 더 완료됨
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Statistics */}
      {showDetailedStats && (
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          {averageTimePerClip && (
            <div className="flex items-center gap-1">
              <span>평균 처리 시간:</span>
              <span className="font-mono">
                {(averageTimePerClip * 60).toFixed(0)}초/곡
              </span>
            </div>
          )}
          {processingRate && (
            <div className="flex items-center gap-1">
              <span>처리 속도:</span>
              <span className="font-mono">
                {processingRate.toFixed(1)}곡/분
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
