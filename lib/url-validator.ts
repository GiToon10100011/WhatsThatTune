"use client";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  urlType?: "video" | "playlist" | "channel";
  extractedId?: string;
}

export interface ErrorMessages {
  INVALID_URL: string;
  NOT_YOUTUBE_URL: string;
  PRIVATE_VIDEO: string;
  DELETED_VIDEO: string;
  NETWORK_ERROR: string;
  TIMEOUT_ERROR: string;
  PARTIAL_FAILURE: string;
  DATABASE_ERROR: string;
  PROCESSING_TIMEOUT: string;
}

export const ERROR_MESSAGES: ErrorMessages = {
  INVALID_URL: "유효하지 않은 URL 형식입니다. YouTube URL을 확인해 주세요.",
  NOT_YOUTUBE_URL:
    "YouTube URL만 지원됩니다. youtube.com 또는 youtu.be 링크를 입력해 주세요.",
  PRIVATE_VIDEO:
    "비공개 또는 제한된 동영상입니다. 공개 동영상의 URL을 사용해 주세요.",
  DELETED_VIDEO:
    "삭제되었거나 존재하지 않는 동영상입니다. 다른 URL을 시도해 주세요.",
  NETWORK_ERROR: "네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.",
  TIMEOUT_ERROR:
    "요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.",
  PARTIAL_FAILURE:
    "일부 클립 생성에 실패했지만, 성공한 {count}개 클립으로 퀴즈를 생성했습니다.",
  DATABASE_ERROR:
    "데이터 저장 중 오류가 발생했습니다. 자동으로 재시도하고 있습니다.",
  PROCESSING_TIMEOUT:
    "처리 시간이 예상보다 오래 걸리고 있습니다. 계속 기다리시거나 취소할 수 있습니다.",
};

/**
 * YouTube URL 유효성 검사
 */
export function validateYouTubeUrl(url: string): ValidationResult {
  if (!url || typeof url !== "string") {
    return {
      isValid: false,
      error: ERROR_MESSAGES.INVALID_URL,
    };
  }

  const trimmedUrl = url.trim();

  // 기본 URL 형식 검사
  try {
    new URL(trimmedUrl);
  } catch {
    return {
      isValid: false,
      error: ERROR_MESSAGES.INVALID_URL,
    };
  }

  // YouTube 도메인 검사
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/;
  if (!youtubeRegex.test(trimmedUrl)) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.NOT_YOUTUBE_URL,
    };
  }

  // 비디오 URL 패턴 검사
  const videoPatterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  // 플레이리스트 URL 패턴 검사
  const playlistPatterns = [
    /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?.*list=([a-zA-Z0-9_-]+)/,
  ];

  // 채널 URL 패턴 검사
  const channelPatterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
  ];

  // 비디오 URL 검사
  for (const pattern of videoPatterns) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      return {
        isValid: true,
        urlType: "video",
        extractedId: match[1],
      };
    }
  }

  // 플레이리스트 URL 검사
  for (const pattern of playlistPatterns) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      return {
        isValid: true,
        urlType: "playlist",
        extractedId: match[1],
      };
    }
  }

  // 채널 URL 검사
  for (const pattern of channelPatterns) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      return {
        isValid: true,
        urlType: "channel",
        extractedId: match[1],
      };
    }
  }

  return {
    isValid: false,
    error: ERROR_MESSAGES.INVALID_URL,
  };
}

/**
 * 여러 URL 일괄 검사
 */
export function validateMultipleUrls(urls: string[]): {
  validUrls: string[];
  invalidUrls: Array<{ url: string; error: string }>;
  summary: string;
} {
  const validUrls: string[] = [];
  const invalidUrls: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    const result = validateYouTubeUrl(url);
    if (result.isValid) {
      validUrls.push(url);
    } else {
      invalidUrls.push({
        url,
        error: result.error || ERROR_MESSAGES.INVALID_URL,
      });
    }
  }

  let summary = "";
  if (validUrls.length > 0 && invalidUrls.length === 0) {
    summary = `${validUrls.length}개의 유효한 URL이 확인되었습니다.`;
  } else if (validUrls.length > 0 && invalidUrls.length > 0) {
    summary = `${validUrls.length}개의 유효한 URL과 ${invalidUrls.length}개의 잘못된 URL이 발견되었습니다.`;
  } else {
    summary = `모든 URL이 유효하지 않습니다. YouTube URL을 확인해 주세요.`;
  }

  return {
    validUrls,
    invalidUrls,
    summary,
  };
}

/**
 * 네트워크 오류 분류 및 메시지 생성
 */
export function classifyNetworkError(error: any): {
  type: "timeout" | "network" | "server" | "unknown";
  message: string;
  retryable: boolean;
} {
  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code;

  // 타임아웃 오류
  if (errorMessage.includes("timeout") || errorCode === "ETIMEDOUT") {
    return {
      type: "timeout",
      message: ERROR_MESSAGES.TIMEOUT_ERROR,
      retryable: true,
    };
  }

  // 네트워크 연결 오류
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorCode === "ECONNREFUSED" ||
    errorCode === "ENOTFOUND"
  ) {
    return {
      type: "network",
      message: ERROR_MESSAGES.NETWORK_ERROR,
      retryable: true,
    };
  }

  // 서버 오류 (5xx)
  if (error?.status >= 500 && error?.status < 600) {
    return {
      type: "server",
      message:
        "서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    };
  }

  // 클라이언트 오류 (4xx)
  if (error?.status >= 400 && error?.status < 500) {
    return {
      type: "server",
      message: "요청을 처리할 수 없습니다. URL을 확인하고 다시 시도해 주세요.",
      retryable: false,
    };
  }

  // 기타 오류
  return {
    type: "unknown",
    message: `알 수 없는 오류가 발생했습니다: ${
      error?.message || "오류 정보 없음"
    }`,
    retryable: false,
  };
}

/**
 * 부분 실패 메시지 생성
 */
export function createPartialFailureMessage(
  successCount: number,
  failureCount: number,
  failedItems?: Array<{ url: string; error: string }>
): string {
  let message = ERROR_MESSAGES.PARTIAL_FAILURE.replace(
    "{count}",
    successCount.toString()
  );

  if (failedItems && failedItems.length > 0) {
    message += "\n\n실패한 항목들:";
    failedItems.slice(0, 3).forEach((item, index) => {
      message += `\n${index + 1}. ${item.url}: ${item.error}`;
    });

    if (failedItems.length > 3) {
      message += `\n... 및 ${failedItems.length - 3}개 더`;
    }
  }

  return message;
}

/**
 * 처리 시간 초과 감지
 */
export function createTimeoutHandler(
  expectedDuration: number,
  onTimeout: () => void,
  onWarning?: (remainingTime: number) => void
): {
  start: () => void;
  stop: () => void;
  reset: () => void;
} {
  let timeoutId: NodeJS.Timeout | null = null;
  let warningId: NodeJS.Timeout | null = null;

  const start = () => {
    stop(); // 기존 타이머 정리

    // 80% 지점에서 경고
    if (onWarning) {
      warningId = setTimeout(() => {
        onWarning(expectedDuration * 0.2);
      }, expectedDuration * 0.8);
    }

    // 100% 지점에서 타임아웃
    timeoutId = setTimeout(() => {
      onTimeout();
    }, expectedDuration);
  };

  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (warningId) {
      clearTimeout(warningId);
      warningId = null;
    }
  };

  const reset = () => {
    stop();
    start();
  };

  return { start, stop, reset };
}
