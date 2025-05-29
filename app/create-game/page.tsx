"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Music, Plus, X } from "lucide-react"
import Link from "next/link"

interface Playlist {
  id: string
  name: string
  service: string
  songCount: number
  duration: string
}

export default function CreateGamePage() {
  const [gameName, setGameName] = useState("")
  const [gameDescription, setGameDescription] = useState("")
  const [selectedPlaylist, setSelectedPlaylist] = useState("")
  const [difficulty, setDifficulty] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const [playlists] = useState<Playlist[]>([
    { id: "1", name: "My Liked Songs", service: "Spotify", songCount: 247, duration: "16h 32m" },
    { id: "2", name: "Road Trip Classics", service: "Spotify", songCount: 45, duration: "3h 12m" },
    { id: "3", name: "Workout Mix", service: "YouTube Music", songCount: 32, duration: "2h 8m" },
    { id: "4", name: "Chill Vibes", service: "Spotify", songCount: 28, duration: "1h 54m" },
  ])

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleCreateGame = () => {
    // Handle game creation logic here
    console.log({
      gameName,
      gameDescription,
      selectedPlaylist,
      difficulty,
      tags,
    })
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Game</h1>
            <p className="text-gray-600 dark:text-gray-300">Set up a new music quiz from your playlists</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Game Details</CardTitle>
                <CardDescription>Basic information about your quiz</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="game-name">Game Name</Label>
                  <Input
                    id="game-name"
                    placeholder="Enter a name for your quiz"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="game-description">Description (Optional)</Label>
                  <Textarea
                    id="game-description"
                    placeholder="Describe your quiz..."
                    value={gameDescription}
                    onChange={(e) => setGameDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Playlist Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Playlist</CardTitle>
                <CardDescription>Choose a playlist to create questions from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Available Playlists</Label>
                  <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      {playlists.map((playlist) => (
                        <SelectItem key={playlist.id} value={playlist.id}>
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4" />
                            <span>{playlist.name}</span>
                            <Badge variant="outline" className="ml-auto">
                              {playlist.service}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlaylist && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    {(() => {
                      const playlist = playlists.find((p) => p.id === selectedPlaylist)
                      return playlist ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{playlist.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {playlist.songCount} songs • {playlist.duration}
                            </p>
                          </div>
                          <Badge>{playlist.service}</Badge>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Game Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Game Settings</CardTitle>
                <CardDescription>Configure difficulty and options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy - 4 answer choices</SelectItem>
                      <SelectItem value="medium">Medium - 6 answer choices</SelectItem>
                      <SelectItem value="hard">Hard - 8 answer choices</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button onClick={addTag} size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="ml-1">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Name</Label>
                    <p className="font-medium">{gameName || "Untitled Quiz"}</p>
                  </div>
                  {selectedPlaylist && (
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Playlist</Label>
                      <p className="font-medium">{playlists.find((p) => p.id === selectedPlaylist)?.name}</p>
                    </div>
                  )}
                  {difficulty && (
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Difficulty</Label>
                      <p className="font-medium capitalize">{difficulty}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={handleCreateGame}
                    disabled={!gameName || !selectedPlaylist || !difficulty}
                  >
                    Create Game
                  </Button>
                  <Button variant="outline" className="w-full">
                    Save as Draft
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
