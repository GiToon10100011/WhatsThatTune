#!/usr/bin/env python3
"""
YouTube 음악 다운로드 및 클립 생성 스크립트
사용법: python create_clips.py urls.txt
"""

import os
import sys
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from typing import List, Dict, Any
from datetime import datetime

try:
    from pydub import AudioSegment
    from mutagen.mp3 import MP3
    from mutagen.id3 import ID3NoHeaderError
except ImportError:
    print("필요한 패키지를 설치하세요: pip install -r requirements.txt")
    sys.exit(1)

# 프로젝트 루트 디렉토리
PROJECT_ROOT = Path(__file__).parent.parent
DOWNLOADS_DIR = PROJECT_ROOT / "public" / "downloads"
CLIPS_DIR = PROJECT_ROOT / "public" / "clips" 
DATA_DIR = PROJECT_ROOT / "public" / "data"
QUIZ_JSON_PATH = DATA_DIR / "quiz.json"

def ensure_directories():
    """필요한 디렉토리 생성"""
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def is_playlist_url(url: str) -> bool:
    """플레이리스트 URL인지 확인"""
    return 'playlist?list=' in url

def extract_playlist_urls(playlist_url: str) -> List[str]:
    """플레이리스트에서 개별 비디오 URL들 추출"""
    try:
        cmd = [
            'yt-dlp',
            '--flat-playlist',
            '--get-id',
            playlist_url
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        video_ids = result.stdout.strip().split('\n')
        
        urls = [f"https://www.youtube.com/watch?v={vid}" for vid in video_ids if vid]
        print(f"플레이리스트에서 {len(urls)}개 비디오 발견")
        return urls
    except subprocess.CalledProcessError as e:
        print(f"플레이리스트 추출 실패: {e}")
        return []

def download_audio(url: str) -> str:
    """YouTube에서 오디오 다운로드"""
    try:
        # 파일명에서 특수문자 제거를 위한 템플릿 설정
        output_template = str(DOWNLOADS_DIR / "%(title)s.%(ext)s")
        
        cmd = [
            'yt-dlp',
            '-x',  # 오디오만 추출
            '--audio-format', 'mp3',  # MP3로 변환
            '--audio-quality', '0',   # 최고 품질
            '-o', output_template,    # 출력 경로
            '--no-playlist',          # 플레이리스트 무시
            url
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # 다운로드된 파일 경로 찾기
        for line in result.stdout.split('\n'):
            if 'Destination:' in line or '[ExtractAudio]' in line:
                # 파일 경로 추출
                for file in DOWNLOADS_DIR.glob("*.mp3"):
                    if file.stat().st_mtime > (subprocess.PIPE):  # 최근 생성된 파일
                        return str(file)
        
        # 가장 최근 mp3 파일 반환
        mp3_files = list(DOWNLOADS_DIR.glob("*.mp3"))
        if mp3_files:
            return str(max(mp3_files, key=lambda x: x.stat().st_mtime))
            
    except subprocess.CalledProcessError as e:
        print(f"다운로드 실패 {url}: {e}")
        
    return None

def clean_filename(filename: str) -> str:
    """파일명에서 특수문자 제거"""
    # 특수문자를 언더스코어로 치환
    clean = re.sub(r'[^\w\s-]', '_', filename)
    # 공백을 언더스코어로 치환
    clean = re.sub(r'[-\s]+', '_', clean)
    return clean.strip('_').lower()

def extract_metadata(audio_path: str) -> Dict[str, Any]:
    """오디오 파일에서 메타데이터 추출"""
    try:
        audio = MP3(audio_path)
        
        title = str(audio.get('TIT2', ['Unknown'])[0]) if audio.get('TIT2') else "Unknown"
        artist = str(audio.get('TPE1', ['Unknown'])[0]) if audio.get('TPE1') else "Unknown"
        album = str(audio.get('TALB', ['Unknown'])[0]) if audio.get('TALB') else "Unknown"
        
        # 파일명에서 정보 추출 (메타데이터가 없는 경우)
        if title == "Unknown":
            basename = Path(audio_path).stem
            # "Artist - Title" 형태로 파싱 시도
            if ' - ' in basename:
                parts = basename.split(' - ', 1)
                artist = parts[0].strip()
                title = parts[1].strip()
        
        return {
            'title': title,
            'artist': artist,
            'album': album
        }
    except (ID3NoHeaderError, Exception):
        # 메타데이터 없는 경우 파일명에서 추출
        basename = Path(audio_path).stem
        if ' - ' in basename:
            parts = basename.split(' - ', 1)
            return {
                'title': parts[1].strip(),
                'artist': parts[0].strip(),
                'album': 'Unknown'
            }
        return {
            'title': basename,
            'artist': 'Unknown', 
            'album': 'Unknown'
        }

def create_clip(audio_path: str, start_time: int = 30, duration: int = 15, clip_duration: int = None) -> str:
    """오디오 클립 생성 (사용자 설정에 따른 길이)"""
    # 사용자 설정 duration 우선 사용
    if clip_duration is not None:
        duration = clip_duration
    try:
        audio = AudioSegment.from_mp3(audio_path)
        
        # 파일이 너무 짧으면 처음부터 사용 가능한 시간만큼
        if len(audio) < (start_time + duration) * 1000:
            start_time = max(0, len(audio) // 1000 - duration)
            if start_time < 0:
                start_time = 0
                duration = len(audio) // 1000
        
        start_ms = start_time * 1000
        end_ms = start_ms + (duration * 1000)
        
        clip = audio[start_ms:end_ms]
        
        # 클립 파일명 생성
        basename = Path(audio_path).stem
        clean_name = clean_filename(basename)
        clip_filename = f"{clean_name}_clip.mp3"
        clip_path = CLIPS_DIR / clip_filename
        
        # 클립 저장
        clip.export(str(clip_path), format="mp3")
        
        print(f"클립 생성: {clip_path}")
        return str(clip_path)
        
    except Exception as e:
        print(f"클립 생성 실패 {audio_path}: {e}")
        return None

def update_quiz_json(songs_data: List[Dict[str, Any]]):
    """quiz.json 파일에 새로운 노래 데이터 추가"""
    try:
        # 기존 데이터 로드
        if QUIZ_JSON_PATH.exists():
            with open(QUIZ_JSON_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {
                "version": "1.0",
                "created": "",
                "games": [],
                "availableSongs": []
            }
        
        # 기존 노래 ID 추적
        existing_ids = {song['id'] for song in data.get('availableSongs', [])}
        
        # 새 노래들 추가
        for song_data in songs_data:
            song_id = f"song_{len(existing_ids) + 1}"
            while song_id in existing_ids:
                song_id = f"song_{len(existing_ids) + len(data['availableSongs']) + 1}"
            
            data['availableSongs'].append({
                "id": song_id,
                "title": song_data['title'],
                "artist": song_data['artist'],
                "album": song_data['album'],
                "clipPath": f"/clips/{Path(song_data['clip_path']).name}",
                "fullPath": f"/downloads/{Path(song_data['audio_path']).name}",
                "duration": song_data['duration'],
                "clipStart": song_data['clip_start'],
                "clipEnd": song_data['clip_start'] + song_data['clip_duration']
            })
            existing_ids.add(song_id)
        
        # 업데이트된 시간 설정
        from datetime import datetime
        data['created'] = datetime.now().isoformat() + 'Z'
        
        # 파일 저장
        with open(QUIZ_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"quiz.json 업데이트 완료: {len(songs_data)}개 노래 추가")
        
    except Exception as e:
        print(f"quiz.json 업데이트 실패: {e}")

def print_progress(current: int, total: int, step: str, song_title: str = "", start_time: float = None):
    """진행률 출력"""
    percentage = (current / total) * 100 if total > 0 else 0
    
    progress_info = {
        "type": "progress",
        "current": current,
        "total": total,
        "percentage": round(percentage, 1),
        "step": step,
        "song_title": song_title,
        "timestamp": datetime.now().isoformat()
    }
    
    if start_time:
        elapsed = time.time() - start_time
        if current > 0:
            avg_time_per_song = elapsed / current
            remaining = (total - current) * avg_time_per_song
            progress_info["estimated_remaining_seconds"] = round(remaining)
            progress_info["estimated_remaining_minutes"] = round(remaining / 60, 1)
    
    print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
    
    # 사람이 읽기 쉬운 형태로도 출력
    eta_str = ""
    if "estimated_remaining_minutes" in progress_info:
        eta_str = f" (예상 남은 시간: {progress_info['estimated_remaining_minutes']}분)"
    
    print(f"[{current}/{total}] {step}: {song_title} ({percentage:.1f}%){eta_str}")

def get_user_settings():
    """사용자 설정 로드 (기본값 포함)"""
    settings = {
        "clip_duration": 15,  # 기본값 15초
        "clip_start_offset": 30  # 기본값 30초 지점에서 시작
    }
    
    # 설정 파일이 있으면 로드
    settings_path = PROJECT_ROOT / "user_settings.json"
    if settings_path.exists():
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                user_settings = json.load(f)
                settings.update(user_settings)
        except Exception as e:
            print(f"설정 파일 로드 실패 (기본값 사용): {e}")
    
    return settings

def process_urls(urls: List[str], user_settings: Dict[str, Any] = None):
    """URL 목록 처리"""
    if user_settings is None:
        user_settings = get_user_settings()
    
    all_songs_data = []
    start_time = time.time()
    
    # 플레이리스트 확장
    original_urls = urls[:]
    expanded_urls = []
    
    print("=== 플레이리스트 확장 중... ===")
    for url in original_urls:
        if is_playlist_url(url):
            individual_urls = extract_playlist_urls(url)
            expanded_urls.extend(individual_urls)
            print(f"플레이리스트에서 {len(individual_urls)}개 비디오 발견")
        else:
            expanded_urls.append(url)
    
    total_songs = len(expanded_urls)
    print(f"총 {total_songs}개 곡 처리 시작")
    
    for i, url in enumerate(expanded_urls, 1):
        
        # 1. 오디오 다운로드
        print_progress(i, total_songs, "다운로드 중", "", start_time)
        audio_path = download_audio(url)
        if not audio_path:
            print("다운로드 실패, 다음 URL로 건너뜀")
            continue
        
        # 2. 메타데이터 추출
        print_progress(i, total_songs, "메타데이터 추출 중", "", start_time)
        metadata = extract_metadata(audio_path)
        
        # 3. 오디오 길이 확인
        try:
            audio = AudioSegment.from_mp3(audio_path)
            duration_seconds = len(audio) // 1000
        except:
            print("오디오 파일 읽기 실패")
            continue
        
        # 4. 클립 생성
        song_title = f"{metadata['artist']} - {metadata['title']}"
        print_progress(i, total_songs, "클립 생성 중", song_title, start_time)
        
        clip_start = min(user_settings['clip_start_offset'], max(0, duration_seconds - user_settings['clip_duration'] - 5))
        clip_path = create_clip(audio_path, clip_start, user_settings['clip_duration'])
        
        if not clip_path:
            print("클립 생성 실패")
            continue
        
        # 5. 데이터 저장
        song_data = {
            'title': metadata['title'],
            'artist': metadata['artist'],
            'album': metadata['album'],
            'audio_path': audio_path,
            'clip_path': clip_path,
            'duration': duration_seconds,
            'clip_start': clip_start,
            'clip_duration': user_settings['clip_duration']
        }
        
        all_songs_data.append(song_data)
        print_progress(i, total_songs, "완료", song_title, start_time)
    
    # quiz.json 업데이트
    if all_songs_data:
        print(f"\n=== quiz.json 업데이트 중... ===")
        update_quiz_json(all_songs_data)
        print(f"총 {len(all_songs_data)}개 노래 처리 완료!")
    else:
        print("처리된 노래가 없습니다.")

def main():
    if len(sys.argv) != 2:
        print("사용법: python create_clips.py <urls_file>")
        print("URLs 파일에는 한 줄에 하나씩 YouTube URL을 입력하세요.")
        sys.exit(1)
    
    urls_file = sys.argv[1]
    
    if not os.path.exists(urls_file):
        print(f"파일을 찾을 수 없습니다: {urls_file}")
        sys.exit(1)
    
    # URL 목록 읽기
    with open(urls_file, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    
    if not urls:
        print("처리할 URL이 없습니다.")
        sys.exit(1)
    
    print(f"{len(urls)}개 URL을 처리합니다.")
    
    # 디렉토리 생성
    ensure_directories()
    
    # 사용자 설정 로드
    user_settings = get_user_settings()
    print(f"사용자 설정: 클립 길이 {user_settings['clip_duration']}초, 시작 지점 {user_settings['clip_start_offset']}초")
    
    # URL 처리
    process_urls(urls, user_settings)

if __name__ == "__main__":
    main()