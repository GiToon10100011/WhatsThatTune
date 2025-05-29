"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, Music, Shield, Eye } from "lucide-react"
import Link from "next/link"

interface ConnectedService {
  name: string
  icon: string
  connected: boolean
  playlists?: number
  description: string
}

export default function AuthPage() {
  const [services, setServices] = useState<ConnectedService[]>([
    {
      name: "Spotify",
      icon: "🎵",
      connected: false,
      description: "Access your Spotify playlists and music library",
    },
    {
      name: "YouTube Music",
      icon: "🎬",
      connected: false,
      description: "Import playlists from YouTube Music",
    },
    {
      name: "Apple Music",
      icon: "🍎",
      connected: false,
      description: "Connect your Apple Music playlists",
    },
  ])

  const [isConnecting, setIsConnecting] = useState<string | null>(null)

  const handleConnect = async (serviceName: string) => {
    setIsConnecting(serviceName)

    // Simulate OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setServices((prev) =>
      prev.map((service) =>
        service.name === serviceName
          ? { ...service, connected: true, playlists: Math.floor(Math.random() * 50) + 10 }
          : service,
      ),
    )
    setIsConnecting(null)
  }

  const handleDisconnect = (serviceName: string) => {
    setServices((prev) =>
      prev.map((service) =>
        service.name === serviceName ? { ...service, connected: false, playlists: undefined } : service,
      ),
    )
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Connect Your Music</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Link your streaming accounts to import playlists
            </p>
          </div>
        </div>

        {/* Connected Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {services.map((service) => (
            <Card
              key={service.name}
              className="relative bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300/80 dark:hover:border-gray-600/80 transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/15 dark:to-purple-400/15 rounded-lg border border-blue-200/20 dark:border-blue-400/20">
                      <span className="text-xl">{service.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg truncate">{service.name}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm line-clamp-2">
                        {service.connected ? `${service.playlists} playlists available` : service.description}
                      </CardDescription>
                    </div>
                  </div>
                  {service.connected && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100/80 text-green-800 dark:bg-green-900/50 dark:text-green-200 ml-2"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Connected</span>
                      <span className="sm:hidden">✓</span>
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {service.connected ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Link href="/import-playlist" className="flex-1">
                        <Button
                          className="w-full bg-gradient-to-r from-blue-500/90 to-purple-500/90 hover:from-blue-600 hover:to-purple-600"
                          size="sm"
                        >
                          <Music className="h-4 w-4 mr-2" />
                          Import Playlists
                        </Button>
                      </Link>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-gray-200/60 dark:border-gray-700/60"
                      onClick={() => handleDisconnect(service.name)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-gradient-to-r from-gray-600/90 to-gray-700/90 hover:from-gray-700 hover:to-gray-800"
                    onClick={() => handleConnect(service.name)}
                    disabled={isConnecting === service.name}
                  >
                    {isConnecting === service.name ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Connecting...
                      </>
                    ) : (
                      `Connect ${service.name}`
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* OAuth Info */}
        <Card className="border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">How it works</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Secure authentication with your music streaming services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="text-center">
                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/15 dark:to-purple-400/15 rounded-full w-fit mx-auto mb-3 border border-blue-200/20 dark:border-blue-400/20">
                  <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Secure Login</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  We use OAuth 2.0 to securely connect to your accounts without storing your passwords
                </p>
              </div>
              <div className="text-center">
                <div className="p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-400/15 dark:to-emerald-400/15 rounded-full w-fit mx-auto mb-3 border border-green-200/20 dark:border-green-400/20">
                  <Eye className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Read-Only Access</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  We only request permission to read your playlists, never to modify them
                </p>
              </div>
              <div className="text-center sm:col-span-2 lg:col-span-1">
                <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-400/15 dark:to-pink-400/15 rounded-full w-fit mx-auto mb-3 border border-purple-200/20 dark:border-purple-400/20">
                  <Music className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Import Playlists</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Once connected, you can import any of your playlists to create quizzes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
