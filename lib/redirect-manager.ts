"use client";

import { useCallback } from "react";

// 리다이렉션 액션 타입
export type RedirectAction =
  | { type: "PLAY_GAME"; gameId: string; message?: string }
  | { type: "CREATE_GAME"; songsCount: number; message?: string }
  | { type: "HOME"; message: string }
  | { type: "ERROR"; error: string };

// 완료 결과 타입
export interface CompletionResult {
  success: boolean;
  quickPlay?: boolean;
  gameId?: string;
  songsCreated: number;
  totalProcessed?: number;
  message?: string;
  error?: string;
}

// 리다이렉션 매니저 클래스
export class RedirectManager {
  private static instance: RedirectManager;
  private redirectHistory: Array<{ action: RedirectAction; timestamp: Date }> =
    [];

  private constructor() {}

  static getInstance(): RedirectManager {
    if (!RedirectManager.instance) {
      RedirectManager.instance = new RedirectManager();
    }
    return RedirectManager.instance;
  }

  // 완료 결과를 기반으로 리다이렉션 액션 결정
  handleCompletion(result: CompletionResult): RedirectAction {
    console.log("RedirectManager: Processing completion result", result);

    // 오류가 있는 경우
    if (!result.success || result.error) {
      return {
        type: "ERROR",
        error: result.error || "처리 중 오류가 발생했습니다.",
      };
    }

    // 생성된 노래가 없는 경우
    if (result.songsCreated === 0) {
      return {
        type: "HOME",
        message:
          "처리가 완료되었지만 생성된 클립이 없습니다. 다른 URL을 시도해 보세요.",
      };
    }

    // Quick Play 모드이고 게임이 생성된 경우
    if (result.quickPlay && result.gameId) {
      return {
        type: "PLAY_GAME",
        gameId: result.gameId,
        message: `${result.songsCreated}개 클립으로 퀴즈가 생성되었습니다! 게임을 시작하세요.`,
      };
    }

    // Quick Play 모드이지만 게임 생성 실패
    if (result.quickPlay && !result.gameId) {
      return {
        type: "CREATE_GAME",
        songsCount: result.songsCreated,
        message: `${result.songsCreated}개 클립이 생성되었습니다. 수동으로 게임을 만들어 주세요.`,
      };
    }

    // 일반 모드 - 게임 생성 페이지로
    return {
      type: "CREATE_GAME",
      songsCount: result.songsCreated,
      message: `${result.songsCreated}개 클립이 준비되었습니다! 이제 퀴즈를 만들어 보세요.`,
    };
  }

  // 리다이렉션 실행
  executeRedirect(action: RedirectAction, delay: number = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("RedirectManager: Executing redirect", action);

      // 히스토리에 추가
      this.redirectHistory.push({
        action,
        timestamp: new Date(),
      });

      // 지연 후 리다이렉션 실행
      setTimeout(() => {
        try {
          switch (action.type) {
            case "PLAY_GAME":
              if (typeof window !== "undefined") {
                window.location.href = `/play/${action.gameId}`;
              }
              break;

            case "CREATE_GAME":
              if (typeof window !== "undefined") {
                window.location.href = "/create-game";
              }
              break;

            case "HOME":
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
              break;

            case "ERROR":
              console.error(
                "RedirectManager: Error action, staying on current page",
                action.error
              );
              // 오류 시에는 리다이렉션하지 않음
              break;

            default:
              console.warn("RedirectManager: Unknown action type", action);
          }
          resolve();
        } catch (error) {
          console.error("RedirectManager: Failed to execute redirect", error);
          reject(error);
        }
      }, delay);
    });
  }

  // 리다이렉션 실패 처리
  handleRedirectFailure(
    error: Error,
    fallbackAction?: RedirectAction
  ): RedirectAction {
    console.error("RedirectManager: Redirect failed", error);

    if (fallbackAction) {
      return fallbackAction;
    }

    return {
      type: "HOME",
      message: "페이지 이동 중 오류가 발생했습니다. 홈으로 돌아갑니다.",
    };
  }

  // 수동 링크 생성 (리다이렉션 실패 시 사용)
  generateManualLinks(
    action: RedirectAction
  ): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];

    switch (action.type) {
      case "PLAY_GAME":
        links.push({
          text: "게임 플레이하기",
          href: `/play/${action.gameId}`,
        });
        links.push({
          text: "홈으로 돌아가기",
          href: "/",
        });
        break;

      case "CREATE_GAME":
        links.push({
          text: "게임 만들기",
          href: "/create-game",
        });
        links.push({
          text: "홈으로 돌아가기",
          href: "/",
        });
        break;

      case "HOME":
      case "ERROR":
        links.push({
          text: "홈으로 돌아가기",
          href: "/",
        });
        links.push({
          text: "다시 시도하기",
          href: "/auth",
        });
        break;
    }

    return links;
  }

  // 리다이렉션 히스토리 조회
  getRedirectHistory(): Array<{ action: RedirectAction; timestamp: Date }> {
    return [...this.redirectHistory];
  }

  // 히스토리 초기화
  clearHistory(): void {
    this.redirectHistory = [];
  }

  // 현재 페이지에서 적절한 다음 액션 제안
  suggestNextAction(
    currentPath: string,
    result?: CompletionResult
  ): RedirectAction | null {
    if (currentPath === "/auth" && result) {
      return this.handleCompletion(result);
    }

    if (currentPath === "/create-game") {
      return {
        type: "HOME",
        message: "게임을 만들었습니다! 홈에서 확인해 보세요.",
      };
    }

    return null;
  }
}

// 싱글톤 인스턴스 내보내기
export const redirectManager = RedirectManager.getInstance();

// React 훅으로 사용하기 위한 유틸리티
export function useRedirectManager() {
  const handleCompletion = useCallback((result: CompletionResult) => {
    const action = redirectManager.handleCompletion(result);
    return action;
  }, []);

  const executeRedirect = useCallback(
    async (action: RedirectAction, delay?: number) => {
      try {
        await redirectManager.executeRedirect(action, delay);
      } catch (error) {
        console.error("Failed to execute redirect:", error);
        const fallbackAction = redirectManager.handleRedirectFailure(
          error as Error
        );
        return fallbackAction;
      }
    },
    []
  );

  const generateManualLinks = useCallback((action: RedirectAction) => {
    return redirectManager.generateManualLinks(action);
  }, []);

  const getHistory = useCallback(
    () => redirectManager.getRedirectHistory(),
    []
  );
  const clearHistory = useCallback(() => redirectManager.clearHistory(), []);

  return {
    handleCompletion,
    executeRedirect,
    generateManualLinks,
    getHistory,
    clearHistory,
  };
}

// 유틸리티 함수들
export function createSuccessResult(
  songsCreated: number,
  quickPlay: boolean = false,
  gameId?: string
): CompletionResult {
  return {
    success: true,
    songsCreated,
    quickPlay,
    gameId,
    message: `${songsCreated}개 클립이 성공적으로 생성되었습니다.`,
  };
}

export function createErrorResult(error: string): CompletionResult {
  return {
    success: false,
    songsCreated: 0,
    error,
  };
}
