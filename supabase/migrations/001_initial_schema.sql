-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create songs table
CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  clip_path TEXT NOT NULL,
  full_path TEXT NOT NULL,
  duration INTEGER NOT NULL,
  clip_start INTEGER NOT NULL,
  clip_end INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create difficulty enum
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Create games table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  difficulty difficulty_level NOT NULL,
  question_count INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create questions table
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  song_id UUID REFERENCES songs(id) NOT NULL,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_plays table
CREATE TABLE game_plays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_taken INTEGER -- in seconds
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_plays ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Songs policies
CREATE POLICY "Users can view all songs" ON songs FOR SELECT TO authenticated;
CREATE POLICY "Users can create their own songs" ON songs FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own songs" ON songs FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own songs" ON songs FOR DELETE USING (auth.uid() = created_by);

-- Games policies
CREATE POLICY "Users can view public games and their own games" ON games FOR SELECT 
  USING (is_public = true OR auth.uid() = created_by);
CREATE POLICY "Users can create their own games" ON games FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own games" ON games FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own games" ON games FOR DELETE USING (auth.uid() = created_by);

-- Questions policies
CREATE POLICY "Users can view questions for accessible games" ON questions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = questions.game_id 
      AND (games.is_public = true OR games.created_by = auth.uid())
    )
  );
CREATE POLICY "Users can create questions for their own games" ON questions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = questions.game_id 
      AND games.created_by = auth.uid()
    )
  );

-- Game plays policies
CREATE POLICY "Users can view their own game plays" ON game_plays FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own game plays" ON game_plays FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to handle user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_songs_updated_at 
  BEFORE UPDATE ON songs 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_games_updated_at 
  BEFORE UPDATE ON games 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_songs_created_by ON songs(created_by);
CREATE INDEX idx_songs_title_artist ON songs(title, artist);
CREATE INDEX idx_games_created_by ON games(created_by);
CREATE INDEX idx_games_is_public ON games(is_public);
CREATE INDEX idx_questions_game_id ON questions(game_id);
CREATE INDEX idx_questions_song_id ON questions(song_id);
CREATE INDEX idx_game_plays_user_id ON game_plays(user_id);
CREATE INDEX idx_game_plays_game_id ON game_plays(game_id);