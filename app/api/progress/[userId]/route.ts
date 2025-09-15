import { NextRequest, NextResponse } from 'next/server'
import { progressStore } from '@/lib/progress-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const progress = progressStore.get(userId)
  
  console.log(`Progress request for user ${userId}:`, progress ? 'Found' : 'Not found')
  console.log('Available keys in progressStore:', Array.from(progressStore.keys()))
  
  if (!progress) {
    return NextResponse.json({ error: 'No progress found' }, { status: 404 })
  }
  
  return NextResponse.json(progress)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const progressData = await request.json()
  
  // 진행률 데이터 저장
  progressStore.set(userId, progressData)
  
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  progressStore.delete(userId)
  
  return NextResponse.json({ success: true })
}