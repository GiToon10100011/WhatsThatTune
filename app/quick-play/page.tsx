"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Youtube, Zap, Music, Settings, Play } from "lucide-react";
import Link from "next/link";
import { getCurrentUser, getSession } from "@/lib/auth";
import { ProcessingProgressModal } from "@/components/processing-progress-modal";
import { validateYouTubeUrl, ERROR_MESSAGES } from "@/lib/url-validator";
import {
  ErrorHandler,
  TimeoutWarning,
  createValidationError,
  createNetworkError,
  type ErrorInfo,
} from "@/components/error-handler";

export default function QuickPlayPage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [quizName, setQuizName] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [isPublic, setIsPublic] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(
    null
  );

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  // 인증되지 않은 사용자 처리
  if (user === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Quick Play를 사용하려면 로그인해야 합니다.
            </p>
            <Link href="/login">
              <Button>로그인하기</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleQuickPlay = async () => {
    // 오류 상태 초기화
    setError(null);

    // URL 유효성 검사
    if (!youtubeUrl.trim()) {
      setError(createValidationError("YouTube URL을 입력해주세요."));
      return;
    }

    const validation = validateYouTubeUrl(youtubeUrl);
    if (!validation.isValid) {
      setError(
        createValidationError(validation.error || ERROR_MESSAGES.INVALID_URL)
      );
      return;
    }

    setIsProcessing(true);
    setShowProgressModal(true);
    setProcessingStartTime(new Date());

    // 타임아웃 경고 설정 (5분 후)
    const timeoutWarning = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 5 * 60 * 1000);

    try {
      // 1. URL 처리 API 호출
      const session = await getSession();
      const token = session?.access_token;

      if (!token) {
        setError(
          createValidationError("인증 토큰이 없습니다. 다시 로그인해주세요.")
        );
        return;
      }

      const response = await fetch("/api/process-urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          urls: [youtubeUrl],
          quickPlay: true,
          quizName:
            quizName.trim() ||
            `Quick Play - ${new Date().toLocaleDateString()}`,
          difficulty,
          questionCount,
          isPublic,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 성공 시 타임아웃 경고 해제
        clearTimeout(timeoutWarning);

        // 부분 실패 체크
        if (result.songsCreated === 0) {
          setError(
            createValidationError(
              "처리된 클립이 없습니다. 다른 URL을 시도해 보세요."
            )
          );
          return;
        }

        // 성공 메시지는 progress modal에서 처리됨
      } else {
        throw new Error(result.error || "Processing failed");
      }
    } catch (error) {
      console.error("Error in quick play:", error);
      clearTimeout(timeoutWarning);
      setError(createNetworkError(error));
    } finally {
      setIsProcessing(false);
      setShowTimeoutWarning(false);
      // 모달은 완료 후에도 유지 (사용자가 직접 닫음)
    }
  };

  const handleRetry = () => {
    setError(null);
    handleQuickPlay();
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    setShowProgressModal(false);
    setShowTimeoutWarning(false);
    setProcessingStartTime(null);
  };

  const handleContinueProcessing = () => {
    setShowTimeoutWarning(false);
    // 타임아웃 경고를 다시 5분 후로 설정
    setTimeout(() => {
      if (isProcessing) {
        setShowTimeoutWarning(true);
      }
    }, 5 * 60 * 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              className="border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              빠른 플레이
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              YouTube URL → 자동 퀴즈 생성 → 바로 플레이
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Quick Play 생성
                </CardTitle>
                <CardDescription>
                  YouTube URL 하나로 즉시 퀴즈를 만들고 플레이하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 오류 표시 */}
                {error && (
                  <ErrorHandler
                    error={error}
                    onRetry={error.retryable ? handleRetry : undefined}
                    onDismiss={() => setError(null)}
                    showRetryButton={error.retryable}
                  />
                )}

                {/* 타임아웃 경고 */}
                {showTimeoutWarning && (
                  <TimeoutWarning
                    isVisible={showTimeoutWarning}
                    remainingTime={300} // 5분
                    onContinue={handleContinueProcessing}
                    onCancel={handleCancelProcessing}
                    processingType="클립 생성"
                  />
                )}

                {/* Quiz Name Input */}
                <div className="space-y-2">
                  <Label
                    htmlFor="quiz-name"
                    className="flex items-center gap-2"
                  >
                    <Music className="h-4 w-4 text-blue-600" />
                    퀴즈 이름 (선택사항)
                  </Label>
                  <Input
                    id="quiz-name"
                    placeholder="퀴즈 이름을 입력하세요 (비워두면 자동 생성)"
                    value={quizName}
                    onChange={(e) => setQuizName(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* YouTube URL Input */}
                <div className="space-y-2">
                  <Label
                    htmlFor="youtube-url"
                    className="flex items-center gap-2"
                  >
                    <Youtube className="h-4 w-4 text-red-600" />
                    YouTube URL
                  </Label>
                  <Input
                    id="youtube-url"
                    placeholder="https://www.youtube.com/watch?v=... 또는 플레이리스트 URL"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Quiz Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">난이도</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">쉬움 (4개 선택지)</SelectItem>
                        <SelectItem value="medium">
                          보통 (6개 선택지)
                        </SelectItem>
                        <SelectItem value="hard">
                          어려움 (8개 선택지)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="question-count">문제 수</Label>
                    <Select
                      value={questionCount.toString()}
                      onValueChange={(v) => setQuestionCount(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3문제</SelectItem>
                        <SelectItem value="5">5문제</SelectItem>
                        <SelectItem value="10">10문제</SelectItem>
                        <SelectItem value="15">15문제</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 공개 설정 */}
                <div className="flex items-center space-x-2 p-3 bg-gray-50/50 dark:bg-gray-700/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="is-public"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is-public" className="text-sm">
                    🌍 퀴즈를 공개하여 다른 사람들과 공유
                  </Label>
                </div>

                {/* Quick Play Button */}
                <Button
                  onClick={handleQuickPlay}
                  disabled={!youtubeUrl.trim() || isProcessing}
                  className="w-full bg-gradient-to-r from-orange-500/90 to-red-500/90 hover:from-orange-600 hover:to-red-600 text-white"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      퀴즈 생성하고 바로 플레이
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* How it works */}
            <Card className="bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Quick Play 특징
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-600 dark:text-orange-400 text-xs font-bold">
                      1
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">즉시 생성</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      URL 입력만으로 자동으로 퀴즈 생성
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-600 dark:text-orange-400 text-xs font-bold">
                      2
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">바로 플레이</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      생성 즉시 게임 화면으로 이동
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-600 dark:text-orange-400 text-xs font-bold">
                      3
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">설정 최소화</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      난이도와 문제 수만 선택하면 끝
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* vs Create Game */}
            <Card className="bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-sm border-blue-200/50 dark:border-blue-700/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-blue-600" />
                  vs 게임 만들기
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>게임 만들기:</strong> 여러 곡을 추가하고 세밀하게
                  커스터마이징
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Quick Play:</strong> 하나의 URL로 빠르게 즉시 플레이
                </p>
                <Link href="/auth" className="block mt-3">
                  <Button
                    variant="outline"
                    className="w-full text-blue-600 border-blue-200"
                  >
                    게임 만들기로 이동
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 진행률 모달 */}
      <ProcessingProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        onCancel={() => {
          setIsProcessing(false);
          setShowProgressModal(false);
        }}
        userId={user?.id}
        quickPlay={true}
      />
    </div>
  );
}
