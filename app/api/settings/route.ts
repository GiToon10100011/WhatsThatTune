import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { snippetDuration } = await request.json()
    
    // 사용자 설정을 JSON 파일로 저장
    const settingsPath = join(process.cwd(), 'user_settings.json')
    
    const settings = {
      clip_duration: snippetDuration || 15,
      clip_start_offset: 30  // 기본값
    }
    
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    
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
        clip_duration: 15,
        clip_start_offset: 30
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