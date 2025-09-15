"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { ArrowLeft, Play, Pause, SkipForward, Volume2, Share2, Clock } from "lucide-react"
import Link from "next/link"
import { getGameById, type QuizGame, type QuizQuestion } from "@/lib/quiz-data"

export default function PlayGamePage({ params }: { params: Promise<{ id: string }> }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(3)
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [gameComplete, setGameComplete] = useState(false)
  const [questionTimeLeft, setQuestionTimeLeft] = useState(15)
  const [questionTimerActive, setQuestionTimerActive] = useState(false)
  const [game, setGame] = useState<QuizGame | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [gameId, setGameId] = useState<string>('')
  const [volume, setVolume] = useState<number>(0.7) // 기본 볼륨 70%

  useEffect(() => {
    const initializeGame = async () => {
      const resolvedParams = await params
      setGameId(resolvedParams.id)
      await loadGame(resolvedParams.id)
    }
    initializeGame()
  }, [])

  const loadGame = async (id: string) => {
    try {
      // 먼저 로컬 스토리지에서 확인
      const createdGames = JSON.parse(localStorage.getItem('created-games') || '[]')
      let foundGame = createdGames.find((g: QuizGame) => g.id === id)
      
      if (!foundGame) {
        // 기본 게임에서 확인
        foundGame = await getGameById(id)
      }
      
      setGame(foundGame)
    } catch (error) {
      console.error('Failed to load game:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const questions = game?.questions || []

  const currentQ = questions[currentQuestion]
  const progress = ((currentQuestion + 1) / questions.length) * 100

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      setIsPlaying(false)
      setQuestionTimerActive(true)
    }
  }, [isPlaying, timeLeft])

  useEffect(() => {
    if (questionTimerActive && questionTimeLeft > 0 && !showResult) {
      const timer = setTimeout(() => setQuestionTimeLeft(questionTimeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (questionTimeLeft === 0 && !showResult) {
      handleAnswer("") // Auto-submit with no answer
    }
  }, [questionTimerActive, questionTimeLeft, showResult])

  const handlePlay = () => {
    if (currentQ) {
      const audio = new Audio(currentQ.clip)
      audio.volume = volume // 볼륨 설정
      setAudioElement(audio)
      
      audio.play()
      setIsPlaying(true)
      setTimeLeft(15) // 15초 클립 재생
      
      audio.onended = () => {
        setIsPlaying(false)
        setQuestionTimerActive(true)
      }
    }
  }

  // 볼륨 변경 핸들러
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (audioElement) {
      audioElement.volume = newVolume
    }
  }

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer)
    setShowResult(true)
    setIsPlaying(false)
    setQuestionTimerActive(false)

    if (answer === currentQ.correctAnswer) {
      setScore(score + 1)
    }
  }

  const handleNext = () => {
    // 현재 재생 중인 오디오 정지
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setIsPlaying(false)
      setTimeLeft(15)
      setQuestionTimeLeft(15)
      setQuestionTimerActive(false)
    } else {
      setGameComplete(true)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">게임 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!game || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <h2 className="text-xl font-bold mb-2">게임을 찾을 수 없습니다</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              요청한 게임이 존재하지 않거나 삭제되었습니다.
            </p>
            <Link href="/">
              <Button>홈으로 돌아가기</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleShare = () => {
    // Implement sharing functionality
    navigator.share?.({
      title: "Music Quiz Challenge",
      text: `I scored ${score}/${questions.length} on this music quiz!`,
      url: window.location.href,
    })
  }

  if (gameComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
          <CardContent className="text-center p-6 sm:p-8">
            <div className="text-4xl sm:text-6xl mb-4">🎉</div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">퀴즈 완료!</h2>
            <p className="text-3xl sm:text-4xl font-bold text-purple-600 mb-4">
              {score}/{questions.length}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {score === questions.length
                ? "만점!"
                : score >= questions.length * 0.7
                  ? "잘했어요!"
                  : "연습 더 해보세요!"}
            </p>
            <div className="space-y-3">
              <Button
                onClick={handleShare}
                className="w-full bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600"
              >
                <Share2 className="h-4 w-4 mr-2" />
                결과 공유
              </Button>
              <Link href="/" className="block">
                <Button variant="outline" className="w-full border-gray-200/60 dark:border-gray-700/60">
                  홈으로 돌아가기
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-4">
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                문제 {currentQuestion + 1} / {questions.length}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                점수: {score}/{questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {questionTimerActive && (
              <Badge
                variant="outline"
                className="text-sm sm:text-lg px-2 sm:px-3 py-1 border-orange-200/60 dark:border-orange-700/60"
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {questionTimeLeft}s
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-sm sm:text-lg px-2 sm:px-3 py-1 border-gray-200/60 dark:border-gray-700/60"
            >
              {Math.round(progress)}%
            </Badge>
          </div>
        </div>

        {/* Progress */}
        <Progress value={progress} className="mb-6 sm:mb-8" />

        {/* Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Audio Player */}
          <div className="lg:col-span-2">
            <Card className="mb-4 sm:mb-6 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="mb-6">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-purple-400/20 to-blue-500/20 dark:from-purple-400/30 dark:to-blue-500/30 rounded-full mx-auto mb-4 flex items-center justify-center border border-purple-200/30 dark:border-purple-400/30">
                    <Volume2 className="h-8 w-8 sm:h-12 sm:w-12 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">음악 클립 듣기</h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    {isPlaying ? `${timeLeft}초 남음` : "재생 버튼을 눌러 시작하세요"}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="flex justify-center gap-4">
                    <Button
                      size="lg"
                      onClick={handlePlay}
                      disabled={isPlaying || showResult}
                      className="px-6 sm:px-8 bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          재생 중...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          클립 재생
                        </>
                      )}
                    </Button>

                    {showResult && (
                      <Button
                        onClick={handleNext}
                        variant="outline"
                        size="lg"
                        className="border-gray-200/60 dark:border-gray-700/60"
                      >
                        <SkipForward className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        다음 문제
                      </Button>
                    )}
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-3 w-full max-w-xs">
                    <Volume2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <Slider
                      value={[volume * 100]}
                      onValueChange={(value) => handleVolumeChange(value[0] / 100)}
                      max={100}
                      min={0}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 min-w-[3ch]">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Answer Options */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-4">이 노래는 무엇일까요?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {currentQ.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={
                        showResult
                          ? option === currentQ.correctAnswer
                            ? "default"
                            : option === selectedAnswer
                              ? "destructive"
                              : "outline"
                          : selectedAnswer === option
                            ? "default"
                            : "outline"
                      }
                      className={`h-auto p-3 sm:p-4 text-left justify-start text-sm sm:text-base border-gray-200/60 dark:border-gray-700/60 relative group ${
                        showResult
                          ? option === currentQ.correctAnswer
                            ? "bg-green-500 hover:bg-green-600 text-white border-green-500"
                            : option === selectedAnswer
                              ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
                              : ""
                          : ""
                      }`}
                      onClick={() => !showResult && handleAnswer(option)}
                      disabled={showResult}
                      title={option} // 호버 시 전체 제목 표시
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                      <span className="truncate capitalize">{option}</span>
                      
                      {/* 호버 안내 툴팁 */}
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 backdrop-blur-sm">
                        호버로 전체 제목 확인
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {showResult && (
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
                <CardContent className="p-4 sm:p-6">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl mb-2">
                      {selectedAnswer === currentQ.correctAnswer ? "✅" : "❌"}
                    </div>
                    <h3 className="font-semibold text-base sm:text-lg mb-2">
                      {selectedAnswer === currentQ.correctAnswer ? "정답!" : "오답"}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                      정답은: <strong>{currentQ.correctAnswer}</strong>
                    </p>
                    <div className="text-xs sm:text-sm">
                      <p>
                        <strong>앨범:</strong> {currentQ.album}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold mb-4 text-base sm:text-lg">게임 진행 상황</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>문제</span>
                    <span>
                      {currentQuestion + 1}/{questions.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>맞힌 개수</span>
                    <span>{score}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>정확도</span>
                    <span>
                      {currentQuestion > 0 ? Math.round((score / (currentQuestion + (showResult ? 1 : 0))) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
