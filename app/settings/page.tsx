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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Volume2,
  Clock,
  Gamepad2,
  Palette,
  Save,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function SettingsPage() {
  const [snippetDuration, setSnippetDuration] = useState([10]); // 최대 10초로 제한
  const [autoPlay, setAutoPlay] = useState(true);
  const [showHints, setShowHints] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [theme, setTheme] = useState("system");
  const [questionTimer, setQuestionTimer] = useState(true);
  const [timerDuration, setTimerDuration] = useState([15]);
  const [cleanupFullDownloads, setCleanupFullDownloads] = useState(true);
  const [downloadOnlyClipDuration, setDownloadOnlyClipDuration] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.settings) {
            setSnippetDuration([result.settings.clip_duration || 10]);
            setCleanupFullDownloads(result.settings.cleanup_full_downloads !== false);
            setDownloadOnlyClipDuration(result.settings.download_only_clip_duration === true);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    
    loadSettings();
  }, []);

  // 설정 저장 함수
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clip_duration: snippetDuration[0],
          cleanup_full_downloads: cleanupFullDownloads,
          download_only_clip_duration: downloadOnlyClipDuration
        })
      });

      if (response.ok) {
        alert('설정이 저장되었습니다!');
      } else {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Settings save error:', error);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-white/90 to-emerald-50/60 dark:from-slate-950/90 dark:via-gray-900/95 dark:to-emerald-950/80 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(16,185,129,0.08)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(16,185,129,0.12)_1px,transparent_0)] [background-size:26px_26px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-emerald-50/20 to-teal-50/20 dark:from-transparent dark:via-emerald-950/20 dark:to-teal-950/20" />

      <div className="relative z-10 container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              className="border-gray-200/60 dark:border-gray-700/60 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              설정
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              음악 퀴즈 경험을 사용자 지정하세요
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Audio Settings */}
          <Card className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-purple-500/15 to-blue-500/15 dark:from-purple-400/25 dark:to-blue-400/25 rounded-lg border border-purple-200/30 dark:border-purple-400/30">
                  <Volume2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg text-gray-900 dark:text-white">
                  오디오 설정
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                음악 조각이 재생되는 방식을 설정하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-900 dark:text-white">
                  클립 재생 시간: {snippetDuration[0]}초
                  {snippetDuration[0] !== 1 ? "s" : ""}
                </Label>
                <Slider
                  value={snippetDuration}
                  onValueChange={setSnippetDuration}
                  max={10}
                  min={3}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  <span>3초</span>
                  <span>5초</span>
                  <span>7초</span>
                  <span>10초 (최대)</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    자동 재생
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    답변 후 다음 조각을 자동으로 재생합니다
                  </p>
                </div>
                <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    전체 파일 자동 삭제
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    클립 생성 후 원본 파일을 삭제하여 공간을 절약합니다
                  </p>
                </div>
                <Switch checked={cleanupFullDownloads} onCheckedChange={setCleanupFullDownloads} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    클립 길이만 다운로드
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    전체 파일 대신 클립 구간만 다운로드합니다 (실험적 기능)
                  </p>
                </div>
                <Switch checked={downloadOnlyClipDuration} onCheckedChange={setDownloadOnlyClipDuration} />
              </div>
            </CardContent>
          </Card>

          {/* Game Settings */}
          <Card className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-blue-500/15 to-emerald-500/15 dark:from-blue-400/25 dark:to-emerald-400/25 rounded-lg border border-blue-200/30 dark:border-blue-400/30">
                  <Gamepad2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg text-gray-900 dark:text-white">
                  게임 설정
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                게임플레이 설정을 조정하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-900 dark:text-white">
                  기본 난이도
                </Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-white/60 dark:bg-gray-800/60 border-gray-200/60 dark:border-gray-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">쉬움 - 4개 선택지</SelectItem>
                    <SelectItem value="medium">보통 - 6개 선택지</SelectItem>
                    <SelectItem value="hard">어려움 - 8개 선택지</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    힌트 보이기
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    힌트로 아티스트 이름이나 앨범 커버를 표시합니다
                  </p>
                </div>
                <Switch checked={showHints} onCheckedChange={setShowHints} />
              </div>
            </CardContent>
          </Card>

          {/* Timer Settings */}
          <Card className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-orange-500/15 to-red-500/15 dark:from-orange-400/25 dark:to-red-400/25 rounded-lg border border-orange-200/30 dark:border-orange-400/30">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-lg text-gray-900 dark:text-white">
                  타이머 설정
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                문제 시간 설정을 구성하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    문제 타이머 사용
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    각 문제에 시간 제한을 추가합니다
                  </p>
                </div>
                <Switch
                  checked={questionTimer}
                  onCheckedChange={setQuestionTimer}
                />
              </div>

              {questionTimer && (
                <div className="space-y-3">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    타이머 시간: {timerDuration[0]}초
                  </Label>
                  <Slider
                    value={timerDuration}
                    onValueChange={setTimerDuration}
                    max={30}
                    min={5}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <span>5s</span>
                    <span>15s</span>
                    <span>30s</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-green-500/15 to-emerald-500/15 dark:from-green-400/25 dark:to-emerald-400/25 rounded-lg border border-green-200/30 dark:border-green-400/30">
                  <Palette className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg text-gray-900 dark:text-white">
                  모양
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                앱의 디자인과 느낌을 사용자 지정하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-900 dark:text-white">
                  테마
                </Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="bg-white/60 dark:bg-gray-800/60 border-gray-200/60 dark:border-gray-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">라이트</SelectItem>
                    <SelectItem value="dark">다크</SelectItem>
                    <SelectItem value="system">시스템</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                >
                  설정 내보내기
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                >
                  설정 가져오기
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700 border-red-200/60 dark:border-red-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                >
                  기본값으로 초기화
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-6 sm:mt-8 flex justify-end">
          <Button
            size="lg"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-6 sm:px-8 bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                설정 저장
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
