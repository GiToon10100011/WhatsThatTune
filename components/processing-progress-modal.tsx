"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { EnhancedProgressDisplay } from "@/components/ui/enhanced-progress-display";
import { Button } from "@/components/ui/button";
import {
  Music,
  Download,
  Scissors,
  CheckCircle,
  Clock,
  X,
  Wifi,
  WifiOff,
  ExternalLink,
} from "lucide-react";
import { useProgressWebSocket } from "@/lib/hooks/useProgressWebSocket";
import {
  useRedirectManager,
  type CompletionResult,
  type RedirectAction,
} from "@/lib/redirect-manager";

interface ProgressData {
  type: string;
  current: number;
  total: number | string; // "???" 인 경우 string
  percentage: number;
  step: string;
  song_title: string;
  timestamp: string;
  estimated_remaining_seconds?: number;
  estimated_remaining_minutes?: number;
  clips_completed?: number; // 완성된 클립 개수
  // completion 타입일 때 추가 필드들
  total_processed?: number;
  total_failed?: number;
  successful?: number;
  failed?: number;
  quick_play?: boolean;
  game_id?: string;
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

interface ProcessingProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  userId?: string;
  quickPlay?: boolean; // Quick Play 모드 여부
}

export function ProcessingProgressModal({
  isOpen,
  onClose,
  onCancel,
  onComplete,
  userId,
  quickPlay = false,
}: ProcessingProgressModalProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [smoothProgress, setSmoothProgress] = useState<ProgressData | null>(
    null
  );
  const [processStarted, setProcessStarted] = useState(false);
  const [totalExpected, setTotalExpected] = useState<number | null>(null);
  const [clipMonitoringActive, setClipMonitoringActive] = useState(false);
  const [redirectAction, setRedirectAction] = useState<RedirectAction | null>(
    null
  );
  const [showManualLinks, setShowManualLinks] = useState(false);

  // Ref to track previous progress to avoid infinite loops
  const prevProgressRef = useRef<ProgressData | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket 훅 사용
  const {
    progress,
    isConnected,
    isConnecting,
    error: wsError,
    reconnectAttempts,
    reconnect,
    clearProgress,
    clearError,
  } = useProgressWebSocket({
    userId,
    autoConnect: isOpen,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });

  // 리다이렉션 매니저 훅 사용
  const { handleCompletion, executeRedirect, generateManualLinks } =
    useRedirectManager();

  // 부드러운 진행률 애니메이션 함수
  const animateProgress = (
    fromProgress: ProgressData,
    toProgress: ProgressData
  ) => {
    // Clear any existing animation
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    const startCurrent = fromProgress.current;
    const endCurrent = toProgress.current;
    const startPercentage = fromProgress.percentage;
    const endPercentage = toProgress.percentage;

    const steps = Math.min(10, endCurrent - startCurrent); // 최대 10스텝
    let currentStep = 0;

    animationIntervalRef.current = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;

      const interpolatedCurrent = Math.floor(
        startCurrent + (endCurrent - startCurrent) * ratio
      );
      const interpolatedPercentage =
        startPercentage + (endPercentage - startPercentage) * ratio;

      setSmoothProgress({
        ...toProgress,
        current: interpolatedCurrent,
        percentage: interpolatedPercentage,
      });

      if (currentStep >= steps) {
        if (animationIntervalRef.current) {
          clearInterval(animationIntervalRef.current);
          animationIntervalRef.current = null;
        }
        setSmoothProgress(toProgress);
      }
    }, 100); // 100ms마다 업데이트
  };

  useEffect(() => {
    if (!isOpen) {
      clearProgress();
      setIsComplete(false);
      clearError();
      setSmoothProgress(null);
      setProcessStarted(false);
      // Clear any running animation
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
      return;
    }

    // WebSocket을 통한 실시간 진행률 업데이트
    // 클립 모니터링 시작 (폴백용)
    const startClipMonitoring = async () => {
      if (!userId) {
        return;
      }

      console.log("Starting clip monitoring for user:", userId);
      setClipMonitoringActive(true);

      try {
        const response = await fetch("/api/progress/monitor-clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        if (response.ok) {
          console.log("Clip monitoring started successfully");
        }
      } catch (error) {
        console.error("Failed to start clip monitoring:", error);
      }
    };
    // 클립 모니터링 시작 (폴백용)
    startClipMonitoring();

    return () => {
      setClipMonitoringActive(false);
      // Clear any running animation on unmount
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [isOpen, userId, clearProgress, clearError]);

  // WebSocket으로 받은 진행률 데이터 처리
  useEffect(() => {
    if (!progress) return;

    // Debounce rapid updates to prevent loops
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      setProcessStarted(true);

      // 총 개수 업데이트
      if ((progress as any).total_songs && !totalExpected) {
        setTotalExpected((progress as any).total_songs);
      }

      if (
        progress.type === "playlist_extracted" &&
        (progress as any).total_videos &&
        !totalExpected
      ) {
        setTotalExpected((progress as any).total_videos);
      }

      // 부드러운 진행률 업데이트 (이전 진행률과 비교)
      const prevProgress = prevProgressRef.current;
      if (prevProgress && progress.current > prevProgress.current) {
        animateProgress(prevProgress, progress);
      } else {
        setSmoothProgress(progress);
      }

      // 현재 진행률을 이전 진행률로 저장
      prevProgressRef.current = progress;

      // 완료 처리
      if (progress.type === "completion") {
        console.log("Completion detected via WebSocket!", progress);
        setIsComplete(true);
        setClipMonitoringActive(false);

        // 완료 결과 데이터 생성
        const successCount =
          progress.successful || (progress as any).total_processed || 0;
        const failureCount = progress.failed || 0;

        let message = "";
        let error = undefined;

        if (successCount > 0 && failureCount > 0) {
          // 부분 성공
          message = `${successCount}개 클립이 성공적으로 생성되었습니다.`;
          error = `${failureCount}개 클립 생성에 실패했지만, 성공한 클립들로 퀴즈를 생성할 수 있습니다.`;
        } else if (successCount > 0) {
          // 완전 성공
          message = `${successCount}개 클립이 성공적으로 생성되었습니다.`;
        } else if (failureCount > 0) {
          // 완전 실패
          message = "클립 생성이 완료되었습니다.";
          error = `모든 클립 생성에 실패했습니다. URL을 확인하고 다시 시도해 주세요.`;
        } else {
          // 알 수 없는 상태
          message = "처리가 완료되었습니다.";
        }

        const completionResult: CompletionResult = {
          success: successCount > 0,
          quickPlay: quickPlay,
          gameId: (progress as any).game_id,
          songsCreated: successCount,
          totalProcessed: (progress as any).total_processed,
          message: message,
          error: error,
        };

        // 리다이렉션 액션 결정
        const action = handleCompletion(completionResult);
        setRedirectAction(action);

        // 완료 콜백 호출
        if (onComplete) {
          setTimeout(() => {
            onComplete();
          }, 1000);
        }

        // 자동 리다이렉션 실행 (3초 후)
        if (action.type !== "ERROR") {
          setTimeout(async () => {
            try {
              await executeRedirect(action, 0);
            } catch (error) {
              console.error("Auto redirect failed:", error);
              setShowManualLinks(true);
            }
          }, 3000);
        }

        // 완료 후 progress data 정리
        setTimeout(() => {
          fetch(`/api/progress/${userId}`, { method: "DELETE" }).catch(
            () => {}
          );
        }, 5000);
      }
    }, 50); // 50ms debounce

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [
    progress,
    totalExpected,
    onComplete,
    userId,
    quickPlay,
    handleCompletion,
    executeRedirect,
  ]);

  const getStepIcon = (step: string) => {
    if (step.includes("다운로드")) return <Download className="h-4 w-4" />;
    if (step.includes("메타데이터")) return <Music className="h-4 w-4" />;
    if (step.includes("클립")) return <Scissors className="h-4 w-4" />;
    if (step.includes("완료")) return <CheckCircle className="h-4 w-4" />;
    return <Music className="h-4 w-4" />;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return "1분 미만";
    return `약 ${Math.ceil(minutes)}분`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            음악 처리 중{/* WebSocket 연결 상태 표시 */}
            <div className="ml-auto flex items-center gap-1">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : isConnecting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-orange-500" />
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>YouTube 음악을 다운로드하고 클립을 생성하고 있습니다</span>
            {!isConnected && reconnectAttempts > 0 && (
              <button
                onClick={reconnect}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                재연결 ({reconnectAttempts}/5)
              </button>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {wsError ? (
            <div className="text-center py-4">
              <div className="text-red-600 dark:text-red-400 mb-2">
                연결 오류가 발생했습니다
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {wsError}
              </div>
              <Button
                onClick={reconnect}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                다시 연결
              </Button>
            </div>
          ) : isComplete ? (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <div className="text-lg font-medium text-green-600 dark:text-green-400">
                처리 완료!
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {(() => {
                  const successCount =
                    smoothProgress?.successful ||
                    progress?.successful ||
                    smoothProgress?.clips_completed ||
                    progress?.clips_completed ||
                    0;
                  const failureCount =
                    smoothProgress?.failed || progress?.failed || 0;

                  if (successCount > 0 && failureCount > 0) {
                    return `${successCount}곡 성공, ${failureCount}곡 실패`;
                  } else if (successCount > 0) {
                    return `${successCount}곡이 성공적으로 처리되었습니다`;
                  } else {
                    return "처리가 완료되었습니다";
                  }
                })()}
              </div>

              {/* 오류 메시지 (부분 실패 시) */}
              {(smoothProgress?.failed || progress?.failed) &&
                (smoothProgress?.failed || progress?.failed) > 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                    일부 클립 생성에 실패했지만, 성공한 클립들로 퀴즈를 생성할
                    수 있습니다.
                  </div>
                )}

              {/* 리다이렉션 메시지 */}
              {redirectAction && (
                <div className="mb-4">
                  {redirectAction.type === "ERROR" ? (
                    <div className="text-red-600 dark:text-red-400 text-sm">
                      {redirectAction.error}
                    </div>
                  ) : (
                    <div className="text-blue-600 dark:text-blue-400 text-sm">
                      {redirectAction.message ||
                        "페이지를 이동하고 있습니다..."}
                      {!showManualLinks && (
                        <div className="mt-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 수동 링크 (리다이렉션 실패 시) */}
              {showManualLinks && redirectAction && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    자동 이동에 실패했습니다. 아래 링크를 클릭해 주세요:
                  </div>
                  {generateManualLinks(redirectAction).map((link, index) => (
                    <a
                      key={index}
                      href={link.href}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mr-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {link.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : smoothProgress || progress ? (
            <>
              {/* Enhanced Progress Display */}
              <EnhancedProgressDisplay
                progress={smoothProgress || progress}
                showDetailedStats={true}
                showEstimatedTime={true}
                showCurrentSong={true}
                animated={true}
              />
            </>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                처리를 시작하고 있습니다...
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {isComplete ? (
            <div className="flex gap-2 w-full">
              {showManualLinks ? (
                <Button onClick={onClose} className="w-full">
                  닫기
                </Button>
              ) : (
                <>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1"
                  >
                    닫기
                  </Button>
                  {redirectAction && redirectAction.type !== "ERROR" && (
                    <Button
                      onClick={() => setShowManualLinks(true)}
                      variant="ghost"
                      className="flex-1"
                    >
                      수동 이동
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                disabled={!onCancel}
              >
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <Button variant="ghost" onClick={onClose} className="flex-1">
                백그라운드에서 계속
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
