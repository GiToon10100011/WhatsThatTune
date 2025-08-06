#!/usr/bin/env python3
"""
자동 퀴즈 생성 스크립트
quiz.json에서 노래 데이터를 읽어 자동으로 객관식 퀴즈를 생성
"""

import json
import random
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# 프로젝트 루트 디렉토리
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"
QUIZ_JSON_PATH = DATA_DIR / "quiz.json"

def load_quiz_data() -> Dict[str, Any]:
    """quiz.json 데이터 로드"""
    try:
        with open(QUIZ_JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"quiz.json 로드 실패: {e}")
        return {
            "version": "1.0",
            "created": "",
            "games": [],
            "availableSongs": []
        }

def save_quiz_data(data: Dict[str, Any]):
    """quiz.json 데이터 저장"""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(QUIZ_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("quiz.json 저장 완료")
    except Exception as e:
        print(f"quiz.json 저장 실패: {e}")

def generate_wrong_options(correct_title: str, all_songs: List[Dict], option_count: int = 4) -> List[str]:
    """틀린 보기 생성"""
    # 정답을 제외한 다른 곡 제목들
    wrong_titles = [song['title'] for song in all_songs if song['title'] != correct_title]
    
    if len(wrong_titles) < option_count - 1:
        print(f"경고: 사용 가능한 노래가 부족합니다. 필요: {option_count-1}, 보유: {len(wrong_titles)}")
        # 부족한 만큼 임의의 제목 생성
        fake_titles = [
            "Unknown Song A", "Unknown Song B", "Unknown Song C",
            "Mystery Track", "Hidden Gem", "Secret Song"
        ]
        wrong_titles.extend(fake_titles)
    
    # 랜덤하게 틀린 답 선택
    selected_wrong = random.sample(wrong_titles, min(option_count - 1, len(wrong_titles)))
    
    # 정답과 함께 섞기
    all_options = selected_wrong + [correct_title]
    random.shuffle(all_options)
    
    return all_options

def create_quiz_game(
    name: str,
    description: str,
    selected_song_ids: List[str],
    difficulty: str,
    question_count: int,
    all_songs: List[Dict]
) -> Dict[str, Any]:
    """퀴즈 게임 생성"""
    
    # 선택된 노래들 필터링
    selected_songs = [song for song in all_songs if song['id'] in selected_song_ids]
    
    if len(selected_songs) < question_count:
        print(f"경고: 요청한 문제 수({question_count})보다 선택된 노래가 적습니다({len(selected_songs)})")
        question_count = len(selected_songs)
    
    # 랜덤하게 섞어서 문제 수만큼 선택
    random.shuffle(selected_songs)
    game_songs = selected_songs[:question_count]
    
    # 난이도별 보기 수
    option_counts = {
        'easy': 4,
        'medium': 6,
        'hard': 8
    }
    option_count = option_counts.get(difficulty, 4)
    
    # 문제 생성
    questions = []
    for i, song in enumerate(game_songs):
        options = generate_wrong_options(song['title'], all_songs, option_count)
        
        question = {
            "id": f"q{i+1}",
            "clip": song['clipPath'],
            "question": "이 노래의 제목은?",
            "correctAnswer": song['title'],
            "options": options,
            "artist": song['artist'],
            "album": song['album']
        }
        questions.append(question)
    
    # 게임 데이터 생성
    game_id = f"game-{int(datetime.now().timestamp())}"
    game = {
        "id": game_id,
        "name": name,
        "description": description,
        "difficulty": difficulty,
        "questionCount": len(questions),
        "created": datetime.now().isoformat() + 'Z',
        "questions": questions
    }
    
    return game

def auto_generate_sample_game(all_songs: List[Dict]) -> Dict[str, Any]:
    """샘플 게임 자동 생성"""
    if len(all_songs) < 3:
        print("샘플 게임을 생성하기에 노래가 부족합니다.")
        return None
    
    # 랜덤하게 노래 선택
    sample_size = min(5, len(all_songs))
    selected_songs = random.sample(all_songs, sample_size)
    selected_ids = [song['id'] for song in selected_songs]
    
    return create_quiz_game(
        name="Auto Generated Quiz",
        description="Automatically generated quiz from available songs",
        selected_song_ids=selected_ids,
        difficulty="medium",
        question_count=sample_size,
        all_songs=all_songs
    )

def list_available_songs(songs: List[Dict]):
    """사용 가능한 노래 목록 표시"""
    print("\n=== 사용 가능한 노래 목록 ===")
    for i, song in enumerate(songs, 1):
        print(f"{i:2d}. {song['artist']} - {song['title']} (ID: {song['id']})")
    print()

def interactive_quiz_creation(all_songs: List[Dict]) -> Dict[str, Any]:
    """대화형 퀴즈 생성"""
    print("\n=== 퀴즈 생성기 ===")
    
    # 노래 목록 표시
    list_available_songs(all_songs)
    
    # 기본 정보 입력
    name = input("퀴즈 이름: ").strip()
    if not name:
        name = "My Quiz"
    
    description = input("퀴즈 설명 (선택): ").strip()
    
    # 난이도 선택
    print("\n난이도 선택:")
    print("1. Easy (4개 보기)")
    print("2. Medium (6개 보기)")
    print("3. Hard (8개 보기)")
    
    difficulty_choice = input("선택 (1-3, 기본 2): ").strip()
    difficulty_map = {'1': 'easy', '2': 'medium', '3': 'hard'}
    difficulty = difficulty_map.get(difficulty_choice, 'medium')
    
    # 노래 선택
    print(f"\n노래 선택 (번호를 쉼표로 구분, 예: 1,3,5):")
    song_input = input("선택할 노래 번호들: ").strip()
    
    try:
        song_indices = [int(x.strip()) - 1 for x in song_input.split(',') if x.strip()]
        selected_songs = [all_songs[i] for i in song_indices if 0 <= i < len(all_songs)]
        
        if not selected_songs:
            print("유효한 노래가 선택되지 않았습니다. 모든 노래를 사용합니다.")
            selected_songs = all_songs
    except (ValueError, IndexError):
        print("잘못된 입력입니다. 모든 노래를 사용합니다.")
        selected_songs = all_songs
    
    # 문제 수 결정
    max_questions = len(selected_songs)
    question_count = min(10, max_questions)
    
    question_input = input(f"문제 수 (최대 {max_questions}, 기본 {question_count}): ").strip()
    try:
        question_count = min(int(question_input), max_questions)
    except ValueError:
        pass
    
    # 퀴즈 생성
    selected_ids = [song['id'] for song in selected_songs]
    return create_quiz_game(name, description, selected_ids, difficulty, question_count, all_songs)

def main():
    print("🎵 퀴즈 생성기 🎵")
    
    # 데이터 로드
    data = load_quiz_data()
    all_songs = data.get('availableSongs', [])
    
    if not all_songs:
        print("사용 가능한 노래가 없습니다.")
        print("먼저 create_clips.py를 실행하여 노래를 추가하세요.")
        sys.exit(1)
    
    print(f"사용 가능한 노래: {len(all_songs)}개")
    
    # 실행 모드 선택
    if len(sys.argv) > 1 and sys.argv[1] == '--auto':
        # 자동 모드
        print("자동 모드: 샘플 퀴즈를 생성합니다...")
        new_game = auto_generate_sample_game(all_songs)
    else:
        # 대화형 모드
        new_game = interactive_quiz_creation(all_songs)
    
    if not new_game:
        print("퀴즈 생성에 실패했습니다.")
        sys.exit(1)
    
    # 게임 추가 및 저장
    data['games'].append(new_game)
    data['created'] = datetime.now().isoformat() + 'Z'
    save_quiz_data(data)
    
    print(f"\n✅ 퀴즈 생성 완료!")
    print(f"   이름: {new_game['name']}")
    print(f"   문제 수: {new_game['questionCount']}")
    print(f"   난이도: {new_game['difficulty']}")
    print(f"   ID: {new_game['id']}")

if __name__ == "__main__":
    main()