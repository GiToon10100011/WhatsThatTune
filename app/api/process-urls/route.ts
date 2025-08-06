import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createClient } from '@supabase/supabase-js'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authorization = request.headers.get('authorization')
    if (!authorization) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const token = authorization.replace('Bearer ', '')
    
    // 서버 사이드 Supabase 클라이언트 생성 (service role key 사용)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // 토큰으로 사용자 검증
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { urls, quickPlay, difficulty, questionCount, isPublic } = await request.json()
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs are required' }, { status: 400 })
    }

    // YouTube URLs를 데이터베이스에 저장
    const urlRecords = []
    for (const url of urls) {
      const { data: urlRecord, error } = await supabase
        .from('youtube_urls')
        .insert({
          url: url.trim(),
          created_by: user.id,
          processed: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving URL to database:', error)
        continue
      }
      urlRecords.push(urlRecord)
    }

    if (urlRecords.length === 0) {
      return NextResponse.json({ error: 'Failed to save URLs' }, { status: 500 })
    }

    // scripts 디렉토리 경로
    const scriptsDir = join(process.cwd(), 'scripts')
    const urlsFilePath = join(scriptsDir, `temp_urls_${user.id}_${Date.now()}.txt`)
    
    // URLs를 임시 파일에 저장 (Python 스크립트용)
    const urlsContent = urls.join('\n')
    await writeFile(urlsFilePath, urlsContent, 'utf-8')
    
    console.log('Starting music processing...')
    console.log('URLs:', urls)
    
    // Python 스크립트 실행
    // 가상환경 Python 사용 (패키지 설치됨)
    let pythonCmd = './venv312/bin/python'
    
    const command = `cd ${scriptsDir} && ${pythonCmd} create_clips.py ${urlsFilePath.split('/').pop()}`
    
    console.log('Executing command:', command)
    
    // 비동기로 실행하고 진행 상황 반환
    const childProcess = execAsync(command, { 
      timeout: 1800000, // 30분 타임아웃 (플레이리스트는 시간이 더 오래 걸림)
      maxBuffer: 5 * 1024 * 1024 // 5MB 버퍼
    })
    
    // 결과 대기 (실제 구현에서는 WebSocket이나 Server-Sent Events 사용 권장)
    const { stdout, stderr } = await childProcess
    
    console.log('Process output:', stdout)
    if (stderr) {
      console.error('Process errors:', stderr)
    }
    
    // 임시 파일 삭제
    try {
      await execAsync(`rm ${urlsFilePath}`)
    } catch (err) {
      console.warn('Failed to delete temp file:', err)
    }
    
    // 처리 완료 후 데이터베이스 상태 업데이트
    for (const record of urlRecords) {
      await supabase
        .from('youtube_urls')
        .update({ processed: true, updated_at: new Date().toISOString() })
        .eq('id', record.id)
    }

    let gameId = null

    // Quick Play 모드인 경우 자동으로 게임 생성
    if (quickPlay) {
      try {
        // 방금 처리된 곡들을 가져오기
        const { data: songs } = await supabase
          .from('songs')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(questionCount || 5)

        if (songs && songs.length > 0) {
          // 자동으로 게임 생성
          const gameData = {
            id: `quick-${Date.now()}`,
            name: `Quick Play - ${new Date().toLocaleDateString()}`,
            description: 'Quick Play로 자동 생성된 퀴즈',
            difficulty: difficulty || 'medium',
            question_count: Math.min(songs.length, questionCount || 5),
            created_by: user.id,
            is_public: isPublic || false
          }

          const { data: newGame, error: gameError } = await supabase
            .from('games')
            .insert(gameData)
            .select()
            .single()

          if (!gameError && newGame) {
            gameId = newGame.id

            // 자동으로 질문들 생성
            const questionsToInsert = songs.slice(0, questionCount || 5).map((song, index) => ({
              id: `q-${gameId}-${index + 1}`,
              game_id: gameId,
              song_id: song.id,
              question: "이 노래의 제목은?",
              correct_answer: song.title,
              options: [song.title], // 임시로 정답만 - 실제로는 generateOptions 사용
              order_index: index + 1
            }))

            await supabase
              .from('questions')
              .insert(questionsToInsert)
          }
        }
      } catch (quickPlayError) {
        console.error('Quick Play 게임 생성 실패:', quickPlayError)
      }
    }

    // 성공 응답
    return NextResponse.json({ 
      success: true, 
      message: 'Music processing completed',
      processedUrls: urlRecords.length,
      gameId,
      output: stdout,
      errors: stderr
    })

  } catch (error) {
    console.error('Error processing URLs:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process URLs', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}