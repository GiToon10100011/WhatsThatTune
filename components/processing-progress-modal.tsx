"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Music, Download, Scissors, CheckCircle, Clock, X } from "lucide-react"

interface ProgressData {
  type: string
  current: number
  total: number
  percentage: number
  step: string
  song_title: string
  timestamp: string
  estimated_remaining_seconds?: number
  estimated_remaining_minutes?: number
}

interface ProcessingProgressModalProps {
  isOpen: boolean
  onClose: () => void
  onCancel?: () => void
}

export function ProcessingProgressModal({ isOpen, onClose, onCancel }: ProcessingProgressModalProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setProgress(null)
      setIsComplete(false)
      setError(null)
      return
    }

    // EventSource나 polling으로 진행률 가져오기
    // 현재는 더미 데이터로 테스트
    const simulateProgress = () => {
      let current = 0
      const total = 34
      
      const interval = setInterval(() => {
        current += 1
        
        const steps = ["다운로드 중", "메타데이터 추출 중", "클립 생성 중", "완료"]
        const stepIndex = Math.floor((current / total) * steps.length)
        const step = steps[Math.min(stepIndex, steps.length - 1)]
        
        const progressData: ProgressData = {
          type: "progress",
          current,
          total,
          percentage: (current / total) * 100,
          step,
          song_title: `Persona 5 OST ${current}`,
          timestamp: new Date().toISOString(),
          estimated_remaining_minutes: Math.max(0, (total - current) * 0.5)
        }
        
        setProgress(progressData)
        
        if (current >= total) {
          setIsComplete(true)
          clearInterval(interval)
        }
      }, 1000)
      
      return () => clearInterval(interval)
    }

    const cleanup = simulateProgress()
    return cleanup
  }, [isOpen])

  const getStepIcon = (step: string) => {
    if (step.includes("다운로드")) return <Download className="h-4 w-4" />
    if (step.includes("메타데이터")) return <Music className="h-4 w-4" />
    if (step.includes("클립")) return <Scissors className="h-4 w-4" />
    if (step.includes("완료")) return <CheckCircle className="h-4 w-4" />
    return <Music className="h-4 w-4" />
  }

  const formatTime = (minutes: number) => {
    if (minutes < 1) return "1분 미만"
    return `약 ${Math.ceil(minutes)}분`
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            음악 처리 중
          </DialogTitle>
          <DialogDescription>
            YouTube 음악을 다운로드하고 클립을 생성하고 있습니다
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="text-center py-4">
              <div className="text-red-600 dark:text-red-400 mb-2">
                처리 중 오류가 발생했습니다
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {error}
              </div>
            </div>
          ) : isComplete ? (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <div className="text-lg font-medium text-green-600 dark:text-green-400">
                처리 완료!
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {progress?.total}곡이 성공적으로 처리되었습니다
              </div>
            </div>
          ) : progress ? (
            <>
              {/* 진행률 바 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{progress.current}/{progress.total} 곡</span>
                  <span>{progress.percentage.toFixed(1)}%</span>
                </div>
                <Progress value={progress.percentage} className="w-full" />
              </div>

              {/* 현재 단계 */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                {getStepIcon(progress.step)}
                <div className="flex-1">
                  <div className="font-medium text-sm">{progress.step}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {progress.song_title}
                  </div>
                </div>
              </div>

              {/* 예상 남은 시간 */}
              {progress.estimated_remaining_minutes !== undefined && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>예상 남은 시간: {formatTime(progress.estimated_remaining_minutes)}</span>
                </div>
              )}
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
            <Button onClick={onClose} className="w-full">
              완료
            </Button>
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
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="flex-1"
              >
                백그라운드에서 계속
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}