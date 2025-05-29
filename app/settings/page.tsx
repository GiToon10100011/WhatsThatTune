"use client";

import { useState } from "react";
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
  const [snippetDuration, setSnippetDuration] = useState([3]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showHints, setShowHints] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [theme, setTheme] = useState("system");
  const [questionTimer, setQuestionTimer] = useState(true);
  const [timerDuration, setTimerDuration] = useState([15]);

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
              Settings
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Customize your music quiz experience
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
                  Audio Settings
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Configure how music snippets are played
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-900 dark:text-white">
                  Snippet Duration: {snippetDuration[0]} second
                  {snippetDuration[0] !== 1 ? "s" : ""}
                </Label>
                <Slider
                  value={snippetDuration}
                  onValueChange={setSnippetDuration}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  <span>1s</span>
                  <span>2s</span>
                  <span>3s</span>
                  <span>4s</span>
                  <span>5s</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    Auto-play snippets
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Automatically play the next snippet after answering
                  </p>
                </div>
                <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
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
                  Game Settings
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Adjust gameplay preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-900 dark:text-white">
                  Default Difficulty
                </Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-white/60 dark:bg-gray-800/60 border-gray-200/60 dark:border-gray-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy - 4 choices</SelectItem>
                    <SelectItem value="medium">Medium - 6 choices</SelectItem>
                    <SelectItem value="hard">Hard - 8 choices</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    Show hints
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Display artist name or album cover as hints
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
                  Timer Settings
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Configure question timing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium text-gray-900 dark:text-white">
                    Enable question timer
                  </Label>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Add time pressure to each question
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
                    Timer Duration: {timerDuration[0]} seconds
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
                  Appearance
                </CardTitle>
              </div>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Customize the app's look and feel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-900 dark:text-white">
                  Theme
                </Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="bg-white/60 dark:bg-gray-800/60 border-gray-200/60 dark:border-gray-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                >
                  Export Settings
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                >
                  Import Settings
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700 border-red-200/60 dark:border-red-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-6 sm:mt-8 flex justify-end">
          <Button
            size="lg"
            className="px-6 sm:px-8 bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
