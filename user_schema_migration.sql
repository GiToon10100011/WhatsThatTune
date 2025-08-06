-- WhatsThatTune 사용자 중심 스키마

-- Users 테이블 (간단한 세션/식별용)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Playlists 테이블 (사용자가 입력한 YouTube URL들)
CREATE TABLE IF NOT EXISTS user_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Playlist',
  youtube_urls TEXT[] NOT NULL, -- YouTube URL 배열
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Songs 테이블 (처리된 곡 정보)
CREATE TABLE IF NOT EXISTS user_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES user_playlists(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  duration INTEGER,
  clip_path TEXT, -- 생성된 클립 파일 경로
  clip_start INTEGER,
  clip_end INTEGER,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Quizzes 테이블
CREATE TABLE IF NOT EXISTS user_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES user_playlists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count INTEGER DEFAULT 5,
  quiz_data JSONB NOT NULL, -- 퀴즈 전체 데이터 (questions, options 등)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_session_id ON users(session_id);
CREATE INDEX IF NOT EXISTS idx_user_playlists_user_id ON user_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_songs_playlist_id ON user_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_user_songs_processing_status ON user_songs(processing_status);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_user_id ON user_quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_playlist_id ON user_quizzes(playlist_id);