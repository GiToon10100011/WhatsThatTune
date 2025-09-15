import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { clip_duration, cleanup_full_downloads, download_only_clip_duration } = await request.json()
    
    // 클립 길이 유효성 검사 (최대 10초)
    const validClipDuration = Math.min(Math.max(clip_duration || 10, 3), 10)
    
    // 사용자 설정을 JSON 파일로 저장
    const settingsPath = join(process.cwd(), 'user_settings.json')
    
    const settings = {
      clip_duration: validClipDuration,
      clip_start_offset: 30, // 기본값 유지
      cleanup_full_downloads: cleanup_full_downloads !== false, // 기본값 true
      download_only_clip_duration: download_only_clip_duration === true // 기본값 false
    }
    
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    
    console.log('Settings saved:', settings)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Settings saved successfully',
      settings 
    })
    
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const settingsPath = join(process.cwd(), 'user_settings.json')
    
    try {
      const fs = await import('fs/promises')
      const settingsContent = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(settingsContent)
      
      return NextResponse.json({ success: true, settings })
    } catch {
      // 파일이 없으면 기본값 반환
      const defaultSettings = {
        clip_duration: 10, // 최대 10초로 변경
        clip_start_offset: 30,
        cleanup_full_downloads: true,
        download_only_clip_duration: false
      }
      return NextResponse.json({ success: true, settings: defaultSettings })
    }
    
  } catch (error) {
    console.error('Error loading settings:', error)
    return NextResponse.json(
      { error: 'Failed to load settings' }, 
      { status: 500 }
    )
  }
}