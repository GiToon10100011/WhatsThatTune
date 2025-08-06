"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Play, Music, Clock, Users, Zap } from "lucide-react"
import Link from "next/link"
import { getPublicGames } from "@/lib/quiz-data"

export default function BrowsePage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGames = async () => {
      try {
        const publicGames = await getPublicGames()
        setGames(publicGames)
      } catch (error) {
        console.error('Error loading games:', error)
      } finally {
        setLoading(false)
      }
    }
    loadGames()
  }, [])

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'secondary'
      case 'hard': return 'destructive'  
      default: return 'default'
    }
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">퀴즈 둘러보기</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              다른 사람들이 만든 공개 퀴즈를 플레이해보세요
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array(6).fill(0).map((_, index) => (
              <Card key={index} className="border-gray-200/50 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm animate-pulse">
                <CardHeader className="pb-3">
                  <div className="space-y-2">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card className="text-center p-8 border-gray-200/50 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <Music className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">아직 공개된 퀴즈가 없습니다</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                첫 번째 공개 퀴즈를 만들어보세요!
              </p>
              <Link href="/quick-play">
                <Button className="bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600">
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Play로 퀴즈 만들기
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-6">
              <Card className="bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium">총 {games.length}개의 공개 퀴즈</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300">
                    🌍 Community
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Games Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {games.map((game) => (
                <Card
                  key={game.id}
                  className="hover:shadow-lg transition-all duration-300 border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/70 dark:hover:border-gray-600/70 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {game.name}
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm line-clamp-2 mt-1">
                          {game.description || "공개된 음악 퀴즈입니다"}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={getDifficultyVariant(game.difficulty)}
                        className="text-xs ml-2"
                      >
                        {game.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Music className="h-3 w-3" />
                          {game.questionCount}문제
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.ceil(game.questionCount * 0.5)}분
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(game.created).toLocaleDateString('ko-KR')} 생성
                      </div>
                      <Link href={`/play/${game.id}`} className="block">
                        <Button
                          className="w-full bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600 text-white border-0 group-hover:shadow-md transition-all"
                          size="sm"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          퀴즈 플레이
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}