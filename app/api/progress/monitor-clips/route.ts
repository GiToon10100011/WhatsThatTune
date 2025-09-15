import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { progressStore } from '@/lib/progress-store'

// 각 사용자별로 totalExpected를 저장
const userTotalExpected = new Map<string, number>()

// 활성 모니터링 세션을 저장
const activeMonitoring = new Map<string, NodeJS.Timeout>()

// 클립 모니터링 로직을 별도 함수로 분리
async function performClipsMonitoring(userId: string): Promise<any> {
  const expectedTotal = userTotalExpected.get(userId)

  const clipsPath = join(process.cwd(), 'public', 'clips')
  
  try {
    const files = await readdir(clipsPath)
    const mp3Files = files.filter(file => file.endsWith('.mp3'))
    
    // 최근 30분 내에 생성된 파일들만 카운트
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    let recentClips = 0
    
    for (const file of mp3Files) {
      try {
        const filePath = join(clipsPath, file)
        const stats = await stat(filePath)
        
        if (stats.mtime > thirtyMinutesAgo) {
          recentClips++
        }
      } catch (err) {
        // 파일 접근 실패는 무시
      }
    }
    
    // 진행률 계산 (totalExpected가 없어도 동작)
    const calculatedPercentage = expectedTotal 
      ? (recentClips / expectedTotal) * 100 
      : Math.min(85, recentClips * 3) // 클립당 3%씩, 최대 85%까지 천천히 올라가다가 완료시 100%
    
    // 진행률 업데이트
    const progressData = {
      type: "clip_monitoring",
      current: recentClips,
      total: expectedTotal || "분석중",
      percentage: expectedTotal ? Math.round(calculatedPercentage * 10) / 10 : calculatedPercentage,
      step: recentClips === 0 ? "클립 생성 대기 중" : `클립 생성 중 (${recentClips}개 완성)`,
      song_title: recentClips === 0 
        ? "첫 번째 클립이 생성되기를 기다리고 있습니다..." 
        : expectedTotal 
          ? `${recentClips}/${expectedTotal} 클립 완성됨`
          : `${recentClips}개 클립 완성됨 (총 개수 분석중)`,
      clips_completed: recentClips,
      timestamp: new Date().toISOString()
    }
    
    console.log(`Auto-monitoring for user ${userId}: found ${recentClips} clips, total expected: ${expectedTotal || 'unknown'}`)
    
    // 완료 확인 (expectedTotal이 있고 달성한 경우, 또는 5분 이상 클립 증가가 없는 경우)
    const shouldComplete = expectedTotal && recentClips >= expectedTotal
    
    if (shouldComplete) {
      progressData.type = "completion"
      progressData.step = "처리 완료"
      progressData.song_title = `모든 클립 생성이 완료되었습니다! (${recentClips}/${expectedTotal} 완성)`
      progressData.percentage = 100
      progressData.total = expectedTotal
      progressData.successful = recentClips
      progressData.failed = 0
      
      // 모니터링 중단
      if (activeMonitoring.has(userId)) {
        clearInterval(activeMonitoring.get(userId)!)
        activeMonitoring.delete(userId)
      }
      userTotalExpected.delete(userId)
      
      console.log(`Auto-monitoring completed for user ${userId}: ${recentClips}/${expectedTotal} clips finished`)
    }
    
    // 진행률 저장
    progressStore.set(userId, progressData)
    
    return progressData
    
  } catch (error) {
    console.error(`Auto-monitoring error for user ${userId}:`, error)
    
    // 클립 폴더가 없거나 접근할 수 없는 경우
    const waitingProgress = {
      type: "clip_monitoring",
      current: 0,
      total: expectedTotal || "분석중",
      percentage: 0,
      step: "클립 생성 준비 중",
      song_title: "다운로드가 시작되기를 기다리고 있습니다...",
      clips_completed: 0,
      timestamp: new Date().toISOString()
    }
    
    progressStore.set(userId, waitingProgress)
    return waitingProgress
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, totalExpected } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    
    // totalExpected가 전달된 경우 저장
    if (totalExpected && totalExpected > 0) {
      userTotalExpected.set(userId, totalExpected)
      console.log(`Total expected set for user ${userId}: ${totalExpected}`)
    }
    
    // 기존 모니터링 세션이 있다면 정리
    if (activeMonitoring.has(userId)) {
      clearInterval(activeMonitoring.get(userId)!)
    }
    
    // 자동 모니터링 시작 (즉시 시작, totalExpected 관계없이)
    const monitoringInterval = setInterval(async () => {
      await performClipsMonitoring(userId)
    }, 2000)
    
    activeMonitoring.set(userId, monitoringInterval)
    console.log(`Auto-monitoring started for user ${userId} (totalExpected: ${totalExpected || 'unknown'})`)
    
    // 클립 모니터링 수행 (수동 호출)
    const progressData = await performClipsMonitoring(userId)
    
    if (!progressData) {
      const expectedTotal = userTotalExpected.get(userId)
      
      // totalExpected가 없는 경우 기본 응답
      const waitingProgress = {
        type: "clip_monitoring",
        current: 0,
        total: expectedTotal || "???",
        percentage: 0,
        step: "클립 생성 준비 중",
        song_title: "처리가 시작되기를 기다리고 있습니다...",
        clips_completed: 0,
        timestamp: new Date().toISOString()
      }
      
      progressStore.set(userId, waitingProgress)
      
      return NextResponse.json({ 
        success: true,
        clipsFound: 0,
        totalExpected: expectedTotal,
        progressData: waitingProgress
      })
    }
    
    return NextResponse.json({ 
      success: true,
      clipsFound: progressData.clips_completed,
      totalExpected: progressData.total,
      progressData
    })
    
  } catch (error) {
    console.error('Clip monitoring error:', error)
    return NextResponse.json(
      { error: 'Failed to monitor clips' }, 
      { status: 500 }
    )
  }
}

// DELETE 요청으로 모니터링 중단
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    
    // 활성 모니터링 중단
    if (activeMonitoring.has(userId)) {
      clearInterval(activeMonitoring.get(userId)!)
      activeMonitoring.delete(userId)
      console.log(`Auto-monitoring stopped for user ${userId}`)
    }
    
    // 저장된 데이터 정리
    userTotalExpected.delete(userId)
    progressStore.delete(userId)
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error stopping clip monitoring:', error)
    return NextResponse.json(
      { error: 'Failed to stop monitoring' }, 
      { status: 500 }
    )
  }
}