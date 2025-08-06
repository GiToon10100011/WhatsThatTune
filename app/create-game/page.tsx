"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Music } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { getAvailableSongs, createQuizGame, type AvailableSong } from "@/lib/quiz-data"

function CreateGameContent() {
  const [gameName, setGameName] = useState("")
  const [gameDescription, setGameDescription] = useState("")
  const [selectedSongs, setSelectedSongs] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState("")
  const [questionCount, setQuestionCount] = useState("10")
  const [isPublic, setIsPublic] = useState(false)
  const [availableSongs, setAvailableSongs] = useState<AvailableSong[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    loadSongs()
  }, [])

  const loadSongs = async () => {
    try {
      const songs = await getAvailableSongs()
      setAvailableSongs(songs)
    } catch (error) {
      console.error('Failed to load songs:', error)
      setError('노래를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSongSelection = (songId: string) => {
    setSelectedSongs(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    )
  }

  const handleCreateGame = async () => {
    if (!gameName || selectedSongs.length === 0 || !difficulty) return
    
    setIsCreating(true)
    setError('')
    
    try {
      const gameData = await createQuizGame(
        gameName,
        gameDescription,
        selectedSongs,
        difficulty,
        parseInt(questionCount),
        isPublic
      )
      
      console.log('Created game:', gameData)
      
      // 게임 플레이 페이지로 이동
      router.push(`/play/${gameData.id}`)
    } catch (error) {
      console.error('Failed to create game:', error)
      setError('게임 생성에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">새 게임 만들기</h1>
            <p className="text-gray-600 dark:text-gray-300">플레이리스트에서 새로운 음악 퀴즈를 설정하세요</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>게임 세부사항</CardTitle>
                <CardDescription>퀴즈에 대한 기본 정보</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="game-name">게임 이름</Label>
                  <Input
                    id="game-name"
                    placeholder="퀴즈 이름을 입력하세요"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="game-description">설명 (선택사항)</Label>
                  <Textarea
                    id="game-description"
                    placeholder="퀴즈에 대해 설명해주세요..."
                    value={gameDescription}
                    onChange={(e) => setGameDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Song Selection */}
            <Card>
              <CardHeader>
                <CardTitle>노래 선택</CardTitle>
                <CardDescription>가져온 음악에서 노래를 선택하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>사용 가능한 노래 ({selectedSongs.length}개 선택됨)</Label>
                  <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">노래 로딩 중...</span>
                      </div>
                    ) : availableSongs.length > 0 ? (
                      availableSongs.map((song) => (
                        <div
                          key={song.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedSongs.includes(song.id)
                              ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700"
                              : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                          onClick={() => toggleSongSelection(song.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSongs.includes(song.id)}
                            onChange={() => toggleSongSelection(song.id)}
                            className="rounded"
                          />
                          <Music className="h-4 w-4 text-gray-500" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{song.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{song.artist}</p>
                          </div>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>

                {availableSongs.length === 0 && (
                  <div className="text-center py-8">
                    <Music className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">사용할 수 있는 노래가 없습니다</p>
                    <p className="text-sm text-gray-500">
                      시작하려면 <Link href="/auth" className="text-blue-600 hover:underline">음악을 가져오세요</Link>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Game Settings */}
            <Card>
              <CardHeader>
                <CardTitle>게임 설정</CardTitle>
                <CardDescription>퀴즈 옵션을 설정하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>문제 수</Label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5문제</SelectItem>
                      <SelectItem value="10">10문제</SelectItem>
                      <SelectItem value="15">15문제</SelectItem>
                      <SelectItem value="20">20문제</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>난이도</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue placeholder="난이도를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">쉬움 - 4개 선택지</SelectItem>
                      <SelectItem value="medium">보통 - 6개 선택지</SelectItem>
                      <SelectItem value="hard">어려움 - 8개 선택지</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>미리보기</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">이름</Label>
                    <p className="font-medium">{gameName || "제목 없는 퀴즈"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">선택한 노래</Label>
                    <p className="font-medium">{selectedSongs.length}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">문제 수</Label>
                    <p className="font-medium">{questionCount}</p>
                  </div>
                  {difficulty && (
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">난이도</Label>
                      <p className="font-medium capitalize">{difficulty}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {error && (
                    <Alert>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="public-game"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                    <Label htmlFor="public-game" className="text-sm">
                      공개 게임으로 만들기
                    </Label>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreateGame}
                    disabled={!gameName || selectedSongs.length === 0 || !difficulty || isCreating}
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        생성 중...
                      </>
                    ) : (
                      '게임 만들기'
                    )}
                  </Button>
                  <Button variant="outline" className="w-full" disabled={isCreating}>
                    임시저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreateGamePage() {
  return (
    <AuthGuard>
      <CreateGameContent />
    </AuthGuard>
  )
}
