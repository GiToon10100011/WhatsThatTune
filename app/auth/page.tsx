"use client";

import { useState, useEffect } from "react";
import { getAvailableSongs } from "@/lib/quiz-data";
import { getCurrentUser, getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Download, Music, Youtube, List } from "lucide-react";
import Link from "next/link";
import { ProcessingProgressModal } from "@/components/processing-progress-modal";
import { validateMultipleUrls, ERROR_MESSAGES } from "@/lib/url-validator";
import {
  ErrorHandler,
  TimeoutWarning,
  createValidationError,
  createNetworkError,
  createPartialError,
  type ErrorInfo,
} from "@/components/error-handler";

export default function ImportPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedSongs, setProcessedSongs] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [duplicatePlaylist, setDuplicatePlaylist] = useState<any>(null);
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(
    null
  );

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        // 사용자의 노래 목록 로드
        const songs = await getAvailableSongs();
        const songTitles = songs.map(
          (song) => `${song.title} - ${song.artist}`
        );
        setProcessedSongs(songTitles);
      }
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
              YouTube URL을 처리하려면 로그인해야 합니다.
            </p>
            <Link href="/login">
              <Button>로그인하기</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleProcessUrls = async () => {
    // 오류 상태 초기화
    setError(null);

    // URL 텍스트를 줄별로 파싱
    const urls = urlInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    if (urls.length === 0) {
      setError(createValidationError("URL을 입력해주세요."));
      return;
    }

    // URL 유효성 검사
    const validation = validateMultipleUrls(urls);

    if (validation.validUrls.length === 0) {
      setError(
        createValidationError(
          "유효한 YouTube URL이 없습니다. URL을 확인해 주세요."
        )
      );
      return;
    }

    // 일부 URL이 유효하지 않은 경우 경고 표시
    if (validation.invalidUrls.length > 0) {
      const partialError = createPartialError(
        validation.validUrls.length,
        validation.invalidUrls.length,
        validation.invalidUrls
      );
      setError(partialError);

      // 3초 후 자동으로 유효한 URL들로 진행
      setTimeout(() => {
        setError(null);
        proceedWithValidUrls(validation.validUrls);
      }, 3000);
      return;
    }

    proceedWithValidUrls(validation.validUrls);
  };

  const proceedWithValidUrls = async (validUrls: string[]) => {
    setIsProcessing(true);
    setShowProgressModal(true);
    setProcessedSongs([]);
    setProcessingStartTime(new Date());

    // 타임아웃 경고 설정 (10분 후 - 여러 URL 처리이므로 더 길게)
    const timeoutWarning = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 10 * 60 * 1000);

    try {
      // API 호출 (인증 토큰 포함)
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
        body: JSON.stringify({ urls: validUrls }),
      });

      const result = await response.json();

      if (response.status === 409 && result.duplicate) {
        // 중복 플레이리스트 감지
        setDuplicatePlaylist(result);
        setIsProcessing(false);
        setShowProgressModal(false);
        return;
      }

      if (result.success) {
        // 처리된 노래 목록 표시
        const songTitles =
          result.songsData?.map(
            (song: any) => `${song.title} - ${song.artist}`
          ) || [];
        setProcessedSongs(songTitles);
        setCompletionResult(result);

        // 완료는 진행률 모달에서 감지됨
      } else {
        throw new Error(result.error || "Processing failed");
      }
    } catch (error) {
      console.error("Error processing URLs:", error);
      alert(
        `처리 실패: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setIsProcessing(false);
      // 모달은 완료 후에도 유지 (사용자가 직접 닫음)
    }
  };

  const handleRetry = () => {
    setError(null);
    handleProcessUrls();
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    setShowProgressModal(false);
    setShowTimeoutWarning(false);
    setProcessingStartTime(null);
  };

  const handleContinueProcessing = () => {
    setShowTimeoutWarning(false);
    // 타임아웃 경고를 다시 10분 후로 설정
    setTimeout(() => {
      if (isProcessing) {
        setShowTimeoutWarning(true);
      }
    }, 10 * 60 * 1000);
  };

  const handleProcessingComplete = () => {
    console.log("Processing completed, redirecting...", completionResult);
    setShowProgressModal(false);

    if (completionResult) {
      if (completionResult.quickPlay && completionResult.gameId) {
        // Quick Play인 경우 바로 게임으로 이동
        window.location.href = `/play/${completionResult.gameId}`;
      } else if (completionResult.songsCreated > 0) {
        // 일반 모드인 경우 게임 생성 페이지로 이동
        window.location.href = "/create-game";
      } else {
        // 노래가 생성되지 않은 경우 홈으로
        window.location.href = "/";
      }
    }
  };

  const handleForceReprocess = async () => {
    setDuplicatePlaylist(null);
    setIsProcessing(true);
    setShowProgressModal(true);

    try {
      const urls = urlInput
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line && !line.startsWith("#") && line.includes("youtube.com")
        );

      const session = await getSession();
      const token = session?.access_token;

      if (!token) {
        alert("인증 토큰이 없습니다. 다시 로그인해주세요.");
        return;
      }

      const response = await fetch("/api/process-urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls, forceReprocess: true }),
      });

      const result = await response.json();

      if (result.success) {
        // 처리된 노래 목록 표시
        const songTitles =
          result.songsData?.map(
            (song: any) => `${song.title} - ${song.artist}`
          ) || [];
        setProcessedSongs(songTitles);
        setCompletionResult(result);

        // 완료는 진행률 모달에서 감지됨
      } else {
        throw new Error(result.error || "Processing failed");
      }
    } catch (error) {
      console.error("Error processing URLs:", error);
      alert(
        `처리 실패: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setIsProcessing(false);
      // 모달은 완료 후에도 유지 (사용자가 직접 닫음)
    }
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
              YouTube 음악 가져오기
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              음악 퀴즈를 만들기 위해 YouTube URL을 추가하세요
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* URL Input */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Youtube className="h-5 w-5 text-red-600" />
                  YouTube URLs
                </CardTitle>
                <CardDescription>
                  YouTube 음악 URL을 입력하세요 (한 줄에 하나씩) 또는
                  플레이리스트 URL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    remainingTime={600} // 10분
                    onContinue={handleContinueProcessing}
                    onCancel={handleCancelProcessing}
                    processingType="URL 처리"
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="url-input">YouTube URL</Label>
                  <Textarea
                    id="url-input"
                    placeholder="https://www.youtube.com/watch?v=fJ9rUzIMcZQ&#10;https://www.youtube.com/watch?v=DyDfgMOUjCI&#10;or&#10;https://www.youtube.com/playlist?list=..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={handleProcessUrls}
                  disabled={!urlInput.trim() || isProcessing}
                  className="w-full bg-gradient-to-r from-red-500/90 to-pink-500/90 hover:from-red-600 hover:to-pink-600"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      URL 처리하기
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Processed Songs */}
            {processedSongs.length > 0 && (
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5 text-green-600" />
                    처리된 노래
                  </CardTitle>
                  <CardDescription>
                    {processedSongs.length}곡이 퀴즈 생성을 위해 준비되었습니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {processedSongs.map((song, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <Music className="h-4 w-4 text-gray-500" />
                        <span className="flex-1 text-sm">{song}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href="/create-game" className="flex-1">
                      <Button className="w-full bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600">
                        퀴즈 만들기
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-lg">작동 방법</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                      1
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">URL 추가</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      YouTube 음악 URL이나 플레이리스트 링크를 붙여넣으세요
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                      2
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">다운로드 & 처리</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      노래가 다운로드되고 10-15초 클립이 생성됩니다
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                      3
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">퀴즈 만들기</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      퀴즈 문제가 자동으로 생성됩니다
                    </p>
                  </div>
                </div>
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
        onComplete={handleProcessingComplete}
        userId={user?.id}
      />

      {/* 중복 플레이리스트 다이얼로그 */}
      {duplicatePlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-orange-600">
                중복 플레이리스트 감지
              </CardTitle>
              <CardDescription>{duplicatePlaylist.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 기존 게임 미리보기 */}
              {duplicatePlaylist.existingGames &&
                duplicatePlaylist.existingGames.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">
                      이 플레이리스트로 만들어진 기존 게임들:
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {duplicatePlaylist.existingGames.map(
                        (game: any, index: number) => (
                          <div
                            key={game.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{game.name}</p>
                              {game.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {game.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                {game.question_count}문제 •{" "}
                                {new Date(game.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Link href={`/play/${game.id}`}>
                              <Button size="sm" variant="outline">
                                플레이
                              </Button>
                            </Link>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDuplicatePlaylist(null)}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleForceReprocess}
                >
                  재처리 (기존 데이터 삭제)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
