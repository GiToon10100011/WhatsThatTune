import { supabase } from './supabase'
import { getCurrentUser } from './auth'

export interface QuizQuestion {
  id: string
  clip: string
  question: string
  correctAnswer: string
  options: string[]
  artist: string
  album: string
  song_id: string
}

export interface QuizGame {
  id: string
  name: string
  description: string
  difficulty: string
  questionCount: number
  created: string
  questions: QuizQuestion[]
  created_by: string
  is_public: boolean
}

export interface AvailableSong {
  id: string
  title: string
  artist: string
  album: string | null
  clipPath: string
  fullPath: string
  duration: number
  clipStart: number
  clipEnd: number
  created_by: string
}

// 사용 가능한 노래 목록 조회
export async function getAvailableSongs(): Promise<AvailableSong[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching songs:', error)
    return []
  }

  return data?.map(song => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    clipPath: song.clip_path || '',
    fullPath: song.full_path || '',
    duration: song.duration || 0,
    clipStart: song.clip_start || 0,
    clipEnd: song.clip_end || 0,
    created_by: song.created_by || 'system'
  })) || []
}

// 게임 ID로 특정 게임 조회
export async function getGameById(gameId: string): Promise<QuizGame | null> {
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (gameError || !gameData) {
    console.error('Error fetching game:', gameError)
    return null
  }

  // 게임의 질문들과 관련 노래 정보 가져오기
  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .select(`
      *,
      songs (
        title,
        artist,
        album,
        clip_path
      )
    `)
    .eq('game_id', gameId)
    .order('order_index')

  if (questionsError) {
    console.error('Error fetching questions:', questionsError)
    return null
  }

  const questions: QuizQuestion[] = questionsData?.map(q => ({
    id: q.id,
    clip: q.songs?.clip_path || '',
    question: q.question,
    correctAnswer: q.correct_answer,
    options: Array.isArray(q.options) ? q.options : [],
    artist: q.songs?.artist || '',
    album: q.songs?.album || '',
    song_id: q.song_id
  })) || []

  return {
    id: gameData.id,
    name: gameData.name,
    description: gameData.description || '',
    difficulty: gameData.difficulty || 'medium',
    questionCount: gameData.question_count,
    created: gameData.created_at || new Date().toISOString(),
    questions,
    created_by: gameData.created_by || 'system',
    is_public: gameData.is_public || false
  }
}

// 사용자의 게임 목록 조회
export async function getUserGames(userId: string): Promise<QuizGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user games:', error)
    return []
  }

  return data?.map(game => ({
    id: game.id,
    name: game.name,
    description: game.description || '',
    difficulty: game.difficulty || 'medium',
    questionCount: game.question_count,
    created: game.created_at || new Date().toISOString(),
    questions: [], // 목록에서는 질문 로드하지 않음
    created_by: game.created_by || 'system',
    is_public: game.is_public || false
  })) || []
}

// 공개 게임 목록 조회
export async function getPublicGames(): Promise<QuizGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching public games:', error)
    return []
  }

  return data?.map(game => ({
    id: game.id,
    name: game.name,
    description: game.description || '',
    difficulty: game.difficulty || 'medium',
    questionCount: game.question_count,
    created: game.created_at || new Date().toISOString(),
    questions: [], // 목록에서는 질문 로드하지 않음
    created_by: game.created_by || 'system',
    is_public: game.is_public || false
  })) || []
}

// 랜덤 보기 생성 함수
export function generateOptions(correctAnswer: string, allSongs: AvailableSong[], optionCount: number = 4): string[] {
  const wrongOptions = allSongs
    .filter(song => song.title !== correctAnswer)
    .map(song => song.title)
  
  // 랜덤하게 틀린 답 선택
  const shuffledWrong = wrongOptions.sort(() => Math.random() - 0.5)
  const selectedWrong = shuffledWrong.slice(0, optionCount - 1)
  
  // 정답과 함께 섞기
  const allOptions = [...selectedWrong, correctAnswer]
  return allOptions.sort(() => Math.random() - 0.5)
}

// 새로운 노래 저장
export async function saveSong(songData: {
  title: string
  artist: string
  album?: string
  clipPath: string
  fullPath: string
  duration: number
  clipStart: number
  clipEnd: number
}): Promise<AvailableSong | null> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('songs')
    .insert({
      title: songData.title,
      artist: songData.artist,
      album: songData.album || null,
      clip_path: songData.clipPath,
      full_path: songData.fullPath,
      duration: songData.duration,
      clip_start: songData.clipStart,
      clip_end: songData.clipEnd,
      created_by: user.id
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving song:', error)
    return null
  }

  return {
    id: data.id,
    title: data.title,
    artist: data.artist,
    album: data.album,
    clipPath: data.clip_path,
    fullPath: data.full_path,
    duration: data.duration,
    clipStart: data.clip_start,
    clipEnd: data.clip_end,
    created_by: data.created_by
  }
}

// 새로운 퀴즈 게임 생성 및 저장
export async function createQuizGame(
  name: string,
  description: string,
  selectedSongIds: string[],
  difficulty: string,
  questionCount: number,
  isPublic: boolean = false
): Promise<QuizGame | null> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // 선택된 노래들 가져오기
  const allSongs = await getAvailableSongs()
  const selectedSongs = allSongs.filter(song => selectedSongIds.includes(song.id))
  const shuffledSongs = selectedSongs.sort(() => Math.random() - 0.5)
  const gameSongs = shuffledSongs.slice(0, Math.min(questionCount, selectedSongs.length))
  
  const optionCounts = {
    easy: 4,
    medium: 6, 
    hard: 8
  }
  
  const optionCount = optionCounts[difficulty as keyof typeof optionCounts] || 4

  // 게임 생성
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .insert({
      name,
      description: description || null,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      question_count: gameSongs.length,
      created_by: user.id,
      is_public: isPublic
    })
    .select()
    .single()

  if (gameError || !gameData) {
    console.error('Error creating game:', gameError)
    return null
  }

  // 질문들 생성 및 저장
  const questionsToInsert = gameSongs.map((song, index) => ({
    game_id: gameData.id,
    song_id: song.id,
    question: "이 노래의 제목은?",
    correct_answer: song.title,
    options: generateOptions(song.title, allSongs, optionCount),
    order_index: index
  }))

  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select()

  if (questionsError) {
    console.error('Error creating questions:', questionsError)
    // 게임은 생성되었지만 질문 생성 실패 시 게임 삭제
    await supabase.from('games').delete().eq('id', gameData.id)
    return null
  }

  // 완성된 게임 데이터 반환
  const questions: QuizQuestion[] = questionsData?.map((q, index) => ({
    id: q.id,
    clip: gameSongs[index].clipPath,
    question: q.question,
    correctAnswer: q.correct_answer,
    options: Array.isArray(q.options) ? q.options : [],
    artist: gameSongs[index].artist,
    album: gameSongs[index].album || '',
    song_id: q.song_id
  })) || []

  return {
    id: gameData.id,
    name: gameData.name,
    description: gameData.description || '',
    difficulty: gameData.difficulty,
    questionCount: gameData.question_count,
    created: gameData.created_at,
    questions,
    created_by: gameData.created_by,
    is_public: gameData.is_public
  }
}

// 게임 플레이 결과 저장
export async function saveGamePlay(
  gameId: string,
  score: number,
  totalQuestions: number,
  timeTaken?: number
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('game_plays')
    .insert({
      game_id: gameId,
      user_id: user.id,
      score,
      total_questions: totalQuestions,
      time_taken: timeTaken || null
    })

  if (error) {
    console.error('Error saving game play:', error)
    return false
  }

  return true
}

// 사용자의 최고 점수 조회
export async function getUserBestScore(gameId: string, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('game_plays')
    .select('score')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data.score
}