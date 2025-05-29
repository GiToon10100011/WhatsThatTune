"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Play, Shuffle, Clock, Music, Zap, Target } from "lucide-react"
import Link from "next/link"

export default function QuickPlayPage() {
  const [isStarting, setIsStarting] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const quickPlayOptions = [
    {
      id: "mixed",
      title: "Mixed Genres",
      description: "A variety of songs from different genres and eras",
      difficulty: "Medium",
      songCount: 15,
      duration: "5-8 min",
      icon: Shuffle,
      color: "from-blue-500/10 to-purple-500/10 dark:from-blue-400/15 dark:to-purple-400/15",
      borderColor: "border-blue-200/20 dark:border-blue-400/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "popular",
      title: "Popular Hits",
      description: "Chart-topping songs from recent years",
      difficulty: "Easy",
      songCount: 12,
      duration: "4-6 min",
      icon: Zap,
      color: "from-emerald-500/10 to-green-500/10 dark:from-emerald-400/15 dark:to-green-400/15",
      borderColor: "border-emerald-200/20 dark:border-emerald-400/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "classics",
      title: "Classic Rock",
      description: "Timeless rock anthems and legendary ballads",
      difficulty: "Hard",
      songCount: 20,
      duration: "7-10 min",
      icon: Target,
      color: "from-orange-500/10 to-red-500/10 dark:from-orange-400/15 dark:to-red-400/15",
      borderColor: "border-orange-200/20 dark:border-orange-400/20",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
  ]

  const handleStartQuickPlay = (optionId: string) => {
    setSelectedOption(optionId)
    setIsStarting(true)
    // Simulate loading and redirect to game
    setTimeout(() => {
      window.location.href = `/play/quick-${optionId}`
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50/40 via-white/80 to-gray-50/20 dark:from-gray-950/60 dark:via-gray-900/80 dark:to-gray-950/40">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Quick Play</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Jump into a quiz without setup</p>
          </div>
        </div>

        {/* Quick Play Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {quickPlayOptions.map((option) => {
            const IconComponent = option.icon
            return (
              <Card
                key={option.id}
                className={`hover:shadow-lg transition-all duration-300 border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/70 dark:hover:border-gray-600/70 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm ${
                  selectedOption === option.id && isStarting ? "ring-2 ring-blue-500/50" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 bg-gradient-to-br ${option.color} rounded-lg border ${option.borderColor}`}>
                        <IconComponent className={`h-5 w-5 ${option.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate">{option.title}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm line-clamp-2">
                          {option.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        option.difficulty === "Easy"
                          ? "secondary"
                          : option.difficulty === "Medium"
                            ? "default"
                            : "destructive"
                      }
                      className="text-xs ml-2"
                    >
                      {option.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        {option.songCount} songs
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {option.duration}
                      </span>
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-gray-600/90 to-gray-700/90 hover:from-gray-700 hover:to-gray-800 text-white border-0"
                      onClick={() => handleStartQuickPlay(option.id)}
                      disabled={isStarting}
                      size="sm"
                    >
                      {isStarting && selectedOption === option.id ? (
                        <>
                          <Shuffle className="h-4 w-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start Quiz
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Info Section */}
        <Card className="border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="p-2 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/15 dark:to-purple-400/15 rounded-lg border border-blue-200/20 dark:border-blue-400/20">
                <Shuffle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              How Quick Play Works
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">No setup required - just pick and play</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="text-center">
                <div className="p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-400/15 dark:to-emerald-400/15 rounded-full w-fit mx-auto mb-3 border border-green-200/20 dark:border-green-400/20">
                  <Music className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">
                  Curated Playlists
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Pre-selected songs from popular streaming platforms
                </p>
              </div>
              <div className="text-center">
                <div className="p-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-400/15 dark:to-red-400/15 rounded-full w-fit mx-auto mb-3 border border-orange-200/20 dark:border-orange-400/20">
                  <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">Instant Start</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  No playlist import needed - start playing immediately
                </p>
              </div>
              <div className="text-center sm:col-span-2 lg:col-span-1">
                <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-400/15 dark:to-pink-400/15 rounded-full w-fit mx-auto mb-3 border border-purple-200/20 dark:border-purple-400/20">
                  <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">
                  Challenge Yourself
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Test your knowledge across different genres and eras
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
