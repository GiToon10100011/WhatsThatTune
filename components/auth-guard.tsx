"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
  requireAuth?: boolean
}

export function AuthGuard({ 
  children, 
  redirectTo = '/login',
  requireAuth = true 
}: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push(redirectTo)
      } else if (!requireAuth && user && redirectTo === '/login') {
        router.push('/')
      }
    }
  }, [user, loading, router, redirectTo, requireAuth])

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-white/90 to-blue-50/60 dark:from-slate-950/90 dark:via-gray-900/95 dark:to-slate-950/80 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // 인증이 필요한데 사용자가 없는 경우
  if (requireAuth && !user) {
    return null
  }

  // 인증이 필요하지 않은데 사용자가 있는 경우 (로그인 페이지 등)
  if (!requireAuth && user && redirectTo === '/login') {
    return null
  }

  return <>{children}</>
}