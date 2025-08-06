-- 기존 JSON 데이터를 테이블로 마이그레이션하는 SQL

-- Songs 데이터 삽입
INSERT INTO songs (id, title, artist, album, clip_path, full_path, duration, clip_start, clip_end) VALUES
('song1', 'Bohemian Rhapsody', 'Queen', 'A Night at the Opera', '/clips/bohemian_rhapsody_clip.mp3', '/downloads/Queen - Bohemian Rhapsody.mp3', 355, 30, 45),
('song2', 'Hotel California', 'Eagles', 'Hotel California', '/clips/hotel_california_clip.mp3', '/downloads/Eagles - Hotel California.mp3', 391, 45, 60),
('song3', 'Stairway to Heaven', 'Led Zeppelin', 'Led Zeppelin IV', '/clips/stairway_to_heaven_clip.mp3', '/downloads/Led Zeppelin - Stairway to Heaven.mp3', 482, 120, 135),
('song4', 'Sweet Child O'' Mine', 'Guns N'' Roses', 'Appetite for Destruction', '/clips/sweet_child_clip.mp3', '/downloads/Guns N'' Roses - Sweet Child O'' Mine.mp3', 356, 60, 75),
('song5', 'Billie Jean', 'Michael Jackson', 'Thriller', '/clips/billie_jean_clip.mp3', '/downloads/Michael Jackson - Billie Jean.mp3', 294, 30, 45)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  artist = EXCLUDED.artist,
  album = EXCLUDED.album,
  clip_path = EXCLUDED.clip_path,
  full_path = EXCLUDED.full_path,
  duration = EXCLUDED.duration,
  clip_start = EXCLUDED.clip_start,
  clip_end = EXCLUDED.clip_end,
  updated_at = NOW();

-- Games 데이터 삽입
INSERT INTO games (id, name, description, difficulty, question_count, created_at) VALUES
('sample-game-1', 'Classic Rock Hits', 'Test your knowledge of classic rock songs', 'medium', 5, '2025-01-08T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  difficulty = EXCLUDED.difficulty,
  question_count = EXCLUDED.question_count,
  updated_at = NOW();

-- Questions 데이터 삽입
INSERT INTO questions (id, game_id, song_id, question, correct_answer, options) VALUES
('q1', 'sample-game-1', 'song1', '이 노래의 제목은?', 'Bohemian Rhapsody', 
 '["Bohemian Rhapsody", "We Will Rock You", "Don''t Stop Me Now", "Another One Bites the Dust"]'::jsonb),
('q2', 'sample-game-1', 'song2', '이 노래의 제목은?', 'Hotel California',
 '["Hotel California", "Take It Easy", "Life in the Fast Lane", "Desperado"]'::jsonb),
('q3', 'sample-game-1', 'song3', '이 노래의 제목은?', 'Stairway to Heaven',
 '["Stairway to Heaven", "Black Dog", "Kashmir", "Whole Lotta Love"]'::jsonb),
('q4', 'sample-game-1', 'song4', '이 노래의 제목은?', 'Sweet Child O'' Mine',
 '["Sweet Child O'' Mine", "Welcome to the Jungle", "Paradise City", "November Rain"]'::jsonb),
('q5', 'sample-game-1', 'song5', '이 노래의 제목은?', 'Billie Jean',
 '["Billie Jean", "Beat It", "Thriller", "Don''t Stop ''Til You Get Enough"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  game_id = EXCLUDED.game_id,
  song_id = EXCLUDED.song_id,
  question = EXCLUDED.question,
  correct_answer = EXCLUDED.correct_answer,
  options = EXCLUDED.options;