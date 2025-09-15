"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  X,
  CheckCircle,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  classifyNetworkError,
  createPartialFailureMessage,
} from "@/lib/url-validator";

export interface ErrorInfo {
  type: "validation" | "network" | "processing" | "partial" | "timeout";
  message: string;
  retryable: boolean;
  details?: any;
  timestamp: Date;
}

interface ErrorHandlerProps {
  error: ErrorInfo | null;
  onRetry?: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
  showRetryButton?: boolean;
  showCancelButton?: boolean;
  className?: string;
}

export function ErrorHandler({
  error,
  onRetry,
  onCancel,
  onDismiss,
  showRetryButton = true,
  showCancelButton = false,
  className = "",
}: ErrorHandlerProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  if (!error) return null;

  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorIcon = () => {
    switch (error.type) {
      case "validation":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "network":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case "processing":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "partial":
        return <CheckCircle className="h-5 w-5 text-yellow-500" />;
      case "timeout":
        return <Clock className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case "validation":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20";
      case "network":
        return "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20";
      case "processing":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20";
      case "partial":
        return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20";
      case "timeout":
        return "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20";
      default:
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20";
    }
  };

  return (
    <Alert className={`${getErrorColor()} ${className}`}>
      <div className="flex items-start gap-3">
        {getErrorIcon()}
        <div className="flex-1 space-y-2">
          <AlertDescription className="text-sm font-medium">
            {error.message}
          </AlertDescription>

          {/* 재시도 횟수 표시 */}
          {retryCount > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              재시도 횟수: {retryCount}회
            </div>
          )}

          {/* 상세 정보 (부분 실패 시) */}
          {error.type === "partial" && error.details && (
            <div className="mt-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded text-xs">
              <div className="font-medium mb-1">상세 정보:</div>
              {error.details.failedItems
                ?.slice(0, 3)
                .map((item: any, index: number) => (
                  <div key={index} className="text-gray-600 dark:text-gray-400">
                    • {item.url}: {item.error}
                  </div>
                ))}
              {error.details.failedItems?.length > 3 && (
                <div className="text-gray-500 dark:text-gray-500">
                  ... 및 {error.details.failedItems.length - 3}개 더
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="flex gap-2 mt-3">
            {showRetryButton && error.retryable && onRetry && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    재시도 중...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    다시 시도
                  </>
                )}
              </Button>
            )}

            {showCancelButton && onCancel && (
              <Button
                onClick={onCancel}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                취소
              </Button>
            )}

            {onDismiss && (
              <Button
                onClick={onDismiss}
                size="sm"
                variant="ghost"
                className="text-xs"
              >
                닫기
              </Button>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

interface TimeoutWarningProps {
  isVisible: boolean;
  remainingTime: number;
  onContinue: () => void;
  onCancel: () => void;
  processingType?: string;
}

export function TimeoutWarning({
  isVisible,
  remainingTime,
  onContinue,
  onCancel,
  processingType = "처리",
}: TimeoutWarningProps) {
  const [countdown, setCountdown] = useState(remainingTime);

  useEffect(() => {
    if (!isVisible) return;

    setCountdown(remainingTime);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, remainingTime]);

  if (!isVisible) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Clock className="h-5 w-5" />
          처리 시간 초과 경고
        </CardTitle>
        <CardDescription className="text-orange-600 dark:text-orange-400">
          {processingType}가 예상보다 오래 걸리고 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p>현재 처리 시간이 예상 시간을 초과했습니다.</p>
          <p>계속 기다리시거나 처리를 취소할 수 있습니다.</p>
        </div>

        {countdown > 0 && (
          <div className="text-xs text-orange-600 dark:text-orange-400">
            자동 취소까지: {minutes}분 {seconds.toString().padStart(2, "0")}초
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onContinue}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            계속 기다리기
          </Button>
          <Button
            onClick={onCancel}
            size="sm"
            variant="destructive"
            className="flex-1"
          >
            처리 취소
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface NetworkRetryProps {
  isVisible: boolean;
  attempt: number;
  maxAttempts: number;
  onRetry: () => void;
  onCancel: () => void;
  error?: string;
}

export function NetworkRetryDialog({
  isVisible,
  attempt,
  maxAttempts,
  onRetry,
  onCancel,
  error,
}: NetworkRetryProps) {
  const [autoRetryCountdown, setAutoRetryCountdown] = useState(5);

  useEffect(() => {
    if (!isVisible) return;

    setAutoRetryCountdown(5);
    const interval = setInterval(() => {
      setAutoRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onRetry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, attempt, onRetry]);

  if (!isVisible) return null;

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <RefreshCw className="h-5 w-5" />
          네트워크 오류 재시도
        </CardTitle>
        <CardDescription className="text-orange-600 dark:text-orange-400">
          연결 문제가 발생했습니다. 자동으로 재시도합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p>
            재시도 {attempt}/{maxAttempts}
          </p>
          {error && (
            <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
          )}
        </div>

        <div className="text-xs text-orange-600 dark:text-orange-400">
          {autoRetryCountdown}초 후 자동 재시도...
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onRetry}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            지금 재시도
          </Button>
          <Button
            onClick={onCancel}
            size="sm"
            variant="destructive"
            className="flex-1"
          >
            취소
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 오류 생성 헬퍼 함수들
export function createValidationError(message: string): ErrorInfo {
  return {
    type: "validation",
    message,
    retryable: false,
    timestamp: new Date(),
  };
}

export function createNetworkError(error: any): ErrorInfo {
  const classified = classifyNetworkError(error);
  return {
    type: "network",
    message: classified.message,
    retryable: classified.retryable,
    details: error,
    timestamp: new Date(),
  };
}

export function createPartialError(
  successCount: number,
  failureCount: number,
  failedItems: Array<{ url: string; error: string }>
): ErrorInfo {
  return {
    type: "partial",
    message: createPartialFailureMessage(
      successCount,
      failureCount,
      failedItems
    ),
    retryable: true,
    details: { successCount, failureCount, failedItems },
    timestamp: new Date(),
  };
}

export function createTimeoutError(message?: string): ErrorInfo {
  return {
    type: "timeout",
    message: message || "처리 시간이 초과되었습니다.",
    retryable: true,
    timestamp: new Date(),
  };
}
