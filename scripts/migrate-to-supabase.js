const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateData() {
  try {
    // Read local quiz data
    const quizDataPath = path.join(__dirname, '../public/data/quiz.json');
    const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
    
    console.log('🚀 Starting data migration to Supabase...');

    // Migrate songs
    console.log('📀 Migrating songs...');
    const songs = quizData.availableSongs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      clip_path: song.clipPath,
      full_path: song.fullPath,
      duration: song.duration,
      clip_start: song.clipStart,
      clip_end: song.clipEnd
    }));

    const { error: songsError } = await supabase
      .from('songs')
      .upsert(songs);

    if (songsError) {
      console.error('❌ Error inserting songs:', songsError);
      return;
    }
    console.log(`✅ Migrated ${songs.length} songs`);

    // Migrate games and questions
    for (const game of quizData.games) {
      console.log(`🎮 Migrating game: ${game.name}`);
      
      // Insert game
      const { error: gameError } = await supabase
        .from('games')
        .upsert({
          id: game.id,
          name: game.name,
          description: game.description,
          difficulty: game.difficulty,
          question_count: game.questionCount
        });

      if (gameError) {
        console.error('❌ Error inserting game:', gameError);
        continue;
      }

      // Insert questions
      const questions = game.questions.map((question, index) => ({
        id: question.id,
        game_id: game.id,
        song_id: question.artist === 'Queen' ? 'song1' :
                 question.artist === 'Eagles' ? 'song2' :
                 question.artist === 'Led Zeppelin' ? 'song3' :
                 question.artist === 'Guns N\' Roses' ? 'song4' :
                 question.artist === 'Michael Jackson' ? 'song5' : 'song1',
        question: question.question,
        correct_answer: question.correctAnswer,
        options: question.options,
        order_index: index + 1
      }));

      const { error: questionsError } = await supabase
        .from('questions')
        .upsert(questions);

      if (questionsError) {
        console.error('❌ Error inserting questions:', questionsError);
      } else {
        console.log(`✅ Migrated ${questions.length} questions for ${game.name}`);
      }
    }

    console.log('🎉 Data migration completed successfully!');
    
    // Verify migration
    const { data: songsCount } = await supabase.from('songs').select('*', { count: 'exact' });
    const { data: gamesCount } = await supabase.from('games').select('*', { count: 'exact' });
    const { data: questionsCount } = await supabase.from('questions').select('*', { count: 'exact' });
    
    console.log('\n📊 Migration Summary:');
    console.log(`Songs: ${songsCount?.length || 0}`);
    console.log(`Games: ${gamesCount?.length || 0}`);
    console.log(`Questions: ${questionsCount?.length || 0}`);

  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

migrateData();