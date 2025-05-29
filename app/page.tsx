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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Play,
  Settings,
  Share2,
  Music,
  Users,
  Trophy,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

interface Game {
  id: string;
  name: string;
  playlist: string;
  songCount: number;
  difficulty: string;
  createdAt: string;
  plays: number;
  bestScore?: number;
}

export default function HomePage() {
  const [games] = useState<Game[]>([
    {
      id: "1",
      name: "90s Rock Hits",
      playlist: "My 90s Playlist",
      songCount: 25,
      difficulty: "Medium",
      createdAt: "2024-01-15",
      plays: 42,
      bestScore: 18,
    },
    {
      id: "2",
      name: "Pop Quiz Challenge",
      playlist: "Top 40 Hits",
      songCount: 30,
      difficulty: "Easy",
      createdAt: "2024-01-10",
      plays: 18,
      bestScore: 25,
    },
    {
      id: "3",
      name: "Indie Deep Cuts",
      playlist: "Hidden Gems",
      songCount: 20,
      difficulty: "Hard",
      createdAt: "2024-01-08",
      plays: 7,
      bestScore: 12,
    },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-white/90 to-blue-50/60 dark:from-slate-950/90 dark:via-gray-900/95 dark:to-slate-950/80 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.08)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.12)_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-50/20 to-purple-50/20 dark:from-transparent dark:via-blue-950/20 dark:to-purple-950/20" />

      <div className="relative z-10 container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/15 to-purple-500/15 dark:from-blue-400/25 dark:to-purple-400/25 rounded-xl border border-blue-200/30 dark:border-blue-400/30 backdrop-blur-sm">
              <Music className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Music Quiz
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                Test your music knowledge
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Link href="/settings">
              <Button
                variant="outline"
                size="icon"
                className="border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button
                variant="outline"
                className="border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Connect Accounts</span>
                <span className="sm:hidden">Connect</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
          <Link href="/create-game">
            <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 border-dashed border-2 border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300/80 dark:hover:border-gray-600/80 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm group">
              <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 text-center">
                <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-500/15 to-blue-500/15 dark:from-purple-400/25 dark:to-blue-400/25 rounded-full mb-4 border border-purple-200/30 dark:border-purple-400/30 group-hover:scale-105 transition-transform duration-300">
                  <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Create New Game
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Import a playlist and create a new music quiz
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/quick-play">
            <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-slate-50/90 to-blue-50/70 dark:from-slate-800/70 dark:to-slate-900/90 border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/70 dark:hover:border-gray-600/70 backdrop-blur-sm group">
              <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 text-center">
                <div className="p-3 sm:p-4 bg-gradient-to-br from-emerald-500/15 to-blue-500/15 dark:from-emerald-400/25 dark:to-blue-400/25 rounded-full mb-4 border border-emerald-200/30 dark:border-emerald-400/30 group-hover:scale-105 transition-transform duration-300">
                  <Play className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Quick Play
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Jump into a random quiz challenge
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Games List */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Your Games
          </h2>
          {games.length === 0 ? (
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60">
              <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                <Music className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-gray-600 dark:text-gray-400">
                  No games yet
                </h3>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mb-4">
                  Create your first music quiz to get started
                </p>
                <Link href="/create-game">
                  <Button className="bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Game
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {games.map((game) => (
                <Card
                  key={game.id}
                  className="hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300/80 dark:hover:border-gray-600/80 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate text-gray-900 dark:text-white">
                          {game.name}
                        </CardTitle>
                        <CardDescription className="text-sm truncate text-gray-600 dark:text-gray-400">
                          {game.playlist}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          game.difficulty === "Easy"
                            ? "secondary"
                            : game.difficulty === "Medium"
                            ? "default"
                            : "destructive"
                        }
                        className="ml-2 text-xs"
                      >
                        {game.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Music className="h-3 w-3" />
                          <span>{game.songCount} songs</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          <span>{game.plays} plays</span>
                        </div>
                        {game.bestScore && (
                          <div className="flex items-center gap-1 col-span-2">
                            <Trophy className="h-3 w-3" />
                            <span>
                              Best: {game.bestScore}/{game.songCount}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/play/${game.id}`} className="flex-1">
                          <Button
                            className="w-full bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600 group-hover:scale-[1.02] transition-transform duration-200"
                            size="sm"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Play
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200/60 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
