#!/usr/bin/env python3
"""
YouTube 음악 다운로드 및 클립 생성 스크립트 (병렬 처리 최적화)
사용법: python create_clips.py urls.txt
"""

import os
import sys
import json
import re
import subprocess
import time
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

# 성능 로깅 모듈 import
from performance_logger import (
    init_performance_logger, 
    get_performance_logger,
    time_step,
    start_step_timing,
    end_step_timing,
    finalize_performance_logging
)

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

# 병렬 처리 설정
MAX_WORKERS = 3  # 동시 처리할 최대 작업 수
PROGRESS_LOCK = threading.Lock()  # 진행률 업데이트 동기화

# 전역 진행률 추적
class ProgressTracker:
    def __init__(self):
        self.completed_videos = []
        self.active_workers = {}
        self.lock = threading.Lock()
    
    def add_completed_video(self, title: str, status: str, error: str = None):
        with self.lock:
            video_info = {"title": title, "status": status}
            if error:
                video_info["error"] = error
            self.completed_videos.append(video_info)
    
    def set_worker_status(self, worker_id: str, video_title: str, stage: str):
        with self.lock:
            self.active_workers[worker_id] = {
                "video_title": video_title,
                "stage": stage
            }
    
    def remove_worker(self, worker_id: str):
        with self.lock:
            self.active_workers.pop(worker_id, None)
    
    def get_progress_data(self):
        with self.lock:
            return {
                "completed_videos": self.completed_videos.copy(),
                "active_workers": list(self.active_workers.values())
            }

# 전역 진행률 추적기 인스턴스
progress_tracker = ProgressTracker()

@dataclass
class ProcessingResult:
    """클립 처리 결과"""
    success: bool
    url: str
    song_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time: float = 0.0

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
            '--no-warnings',
            playlist_url
        ]
        
        print(f"플레이리스트 추출 시작: {playlist_url}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # 출력 정리 및 빈 줄 제거
        video_ids = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]
        
        # 유효한 YouTube 비디오 ID만 필터링 (11자리 문자열)
        valid_ids = [vid for vid in video_ids if vid and len(vid) == 11 and vid.isalnum()]
        
        urls = [f"https://www.youtube.com/watch?v={vid}" for vid in valid_ids]
        
        print(f"플레이리스트에서 {len(urls)}개 유효한 비디오 발견")
        
        # 진행률 정보 출력
        progress_info = {
            "type": "playlist_extracted",
            "total_videos": len(urls),
            "message": f"플레이리스트에서 {len(urls)}개 비디오를 발견했습니다",
            "timestamp": datetime.now().isoformat()
        }
        print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
        
        return urls
    except subprocess.CalledProcessError as e:
        print(f"플레이리스트 추출 실패: {e}")
        error_info = {
            "type": "playlist_error",
            "message": f"플레이리스트 추출 실패: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
        print(f"PROGRESS: {json.dumps(error_info, ensure_ascii=False)}")
        return []

def process_single_url(url: str, index: int, total: int, user_settings: Dict[str, Any], start_time: float) -> ProcessingResult:
    """단일 URL을 처리하여 클립 생성 (병렬 처리용 + 성능 로깅)"""
    processing_start = time.time()
    song_title = f"곡 {index}/{total}"  # 초기 제목
    worker_id = f"worker_{threading.current_thread().ident}_{index}"
    
    try:
        # 1. 오디오 다운로드
        progress_tracker.set_worker_status(worker_id, song_title, "다운로드 중")
        with PROGRESS_LOCK:
            print_enhanced_progress(index, total, "다운로드 중", song_title, start_time)
        
        download_step_id = start_step_timing("Audio Download", "download", song_title, {"url": url, "index": index})
        
        try:
            audio_path = download_audio(url, user_settings)
            if not audio_path:
                end_step_timing(download_step_id, False, "다운로드 실패")
                progress_tracker.add_completed_video(song_title, "failed", "다운로드 실패")
                progress_tracker.remove_worker(worker_id)
                return ProcessingResult(
                    success=False,
                    url=url,
                    error="다운로드 실패",
                    processing_time=time.time() - processing_start
                )
            end_step_timing(download_step_id, True, None, {"audio_path": audio_path})
        except Exception as e:
            end_step_timing(download_step_id, False, str(e))
            progress_tracker.add_completed_video(song_title, "failed", str(e))
            progress_tracker.remove_worker(worker_id)
            raise
        
        # 2. 메타데이터 추출
        progress_tracker.set_worker_status(worker_id, song_title, "메타데이터 추출 중")
        metadata_step_id = start_step_timing("Metadata Extraction", "metadata_extraction", song_title, {"audio_path": audio_path})
        
        try:
            metadata = extract_metadata(audio_path)
            song_title = metadata['title']  # 실제 제목으로 업데이트
            progress_tracker.set_worker_status(worker_id, song_title, "메타데이터 추출 중")
            end_step_timing(metadata_step_id, True, None, {"extracted_title": song_title})
        except Exception as e:
            end_step_timing(metadata_step_id, False, str(e))
            metadata = {'title': f'Unknown_{index}', 'album': 'Unknown'}
            song_title = metadata['title']
            progress_tracker.set_worker_status(worker_id, song_title, "메타데이터 추출 중")
        
        with PROGRESS_LOCK:
            print_enhanced_progress(index, total, "메타데이터 추출 중", song_title, start_time)
        
        # 3. 오디오 길이 확인
        progress_tracker.set_worker_status(worker_id, song_title, "오디오 분석 중")
        audio_analysis_step_id = start_step_timing("Audio Analysis", "metadata_extraction", song_title, {"audio_path": audio_path})
        
        try:
            audio = AudioSegment.from_mp3(audio_path)
            duration_seconds = len(audio) // 1000
            end_step_timing(audio_analysis_step_id, True, None, {"duration": duration_seconds})
        except Exception as e:
            end_step_timing(audio_analysis_step_id, False, str(e))
            progress_tracker.add_completed_video(song_title, "failed", f"오디오 파일 읽기 실패: {str(e)}")
            progress_tracker.remove_worker(worker_id)
            if user_settings.get('cleanup_full_downloads', True):
                cleanup_full_download(audio_path)
            return ProcessingResult(
                success=False,
                url=url,
                error=f"오디오 파일 읽기 실패: {str(e)}",
                processing_time=time.time() - processing_start
            )
        
        # 4. 클립 생성
        progress_tracker.set_worker_status(worker_id, song_title, "클립 생성 중")
        with PROGRESS_LOCK:
            print_enhanced_progress(index, total, "클립 생성 중", song_title, start_time)
        
        clip_generation_step_id = start_step_timing("Clip Generation", "clip_generation", song_title, {
            "duration": duration_seconds,
            "clip_start_offset": user_settings['clip_start_offset'],
            "clip_duration": user_settings['clip_duration']
        })
        
        try:
            clip_start = min(user_settings['clip_start_offset'], max(0, duration_seconds - user_settings['clip_duration'] - 5))
            clip_path = create_clip(audio_path, clip_start, user_settings['clip_duration'])
            
            if not clip_path:
                end_step_timing(clip_generation_step_id, False, "클립 생성 실패")
                progress_tracker.add_completed_video(song_title, "failed", "클립 생성 실패")
                progress_tracker.remove_worker(worker_id)
                if user_settings.get('cleanup_full_downloads', True):
                    cleanup_full_download(audio_path)
                return ProcessingResult(
                    success=False,
                    url=url,
                    error="클립 생성 실패",
                    processing_time=time.time() - processing_start
                )
            
            end_step_timing(clip_generation_step_id, True, None, {
                "clip_path": clip_path,
                "clip_start": clip_start,
                "clip_duration": user_settings['clip_duration']
            })
        except Exception as e:
            end_step_timing(clip_generation_step_id, False, str(e))
            progress_tracker.add_completed_video(song_title, "failed", str(e))
            progress_tracker.remove_worker(worker_id)
            raise
        
        # 5. 전체 파일 정리 (설정에 따라)
        progress_tracker.set_worker_status(worker_id, song_title, "파일 정리 중")
        full_path_for_data = audio_path
        if user_settings.get('cleanup_full_downloads', True):
            with PROGRESS_LOCK:
                print_enhanced_progress(index, total, "파일 정리 중", song_title, start_time)
            
            cleanup_step_id = start_step_timing("File Cleanup", "file_cleanup", song_title, {"audio_path": audio_path})
            
            try:
                cleanup_full_download(audio_path)
                full_path_for_data = None
                end_step_timing(cleanup_step_id, True, None, {"cleaned_up": True})
            except Exception as e:
                end_step_timing(cleanup_step_id, False, str(e))
                # 정리 실패는 치명적이지 않으므로 계속 진행
        
        # 6. 데이터 준비
        song_data = {
            'title': metadata['title'],
            'album': metadata['album'],
            'audio_path': full_path_for_data,
            'clip_path': clip_path,
            'duration': duration_seconds,
            'clip_start': clip_start,
            'clip_duration': user_settings['clip_duration']
        }
        
        progress_tracker.add_completed_video(song_title, "success")
        progress_tracker.remove_worker(worker_id)
        
        with PROGRESS_LOCK:
            print_enhanced_progress(index, total, "완료", song_title, start_time)
        
        return ProcessingResult(
            success=True,
            url=url,
            song_data=song_data,
            processing_time=time.time() - processing_start
        )
        
    except Exception as e:
        progress_tracker.add_completed_video(song_title, "failed", f"예상치 못한 오류: {str(e)}")
        progress_tracker.remove_worker(worker_id)
        return ProcessingResult(
            success=False,
            url=url,
            error=f"예상치 못한 오류: {str(e)}",
            processing_time=time.time() - processing_start
        )

def download_audio(url: str, user_settings: Dict[str, Any] = None) -> str:
    """YouTube에서 오디오 다운로드"""
    if user_settings is None:
        user_settings = get_user_settings()
        
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
        ]
        
        # 클립 길이만 다운로드 하는 경우
        if user_settings.get('download_only_clip_duration', False):
            start_time = user_settings.get('clip_start_offset', 30)
            duration = user_settings.get('clip_duration', 10)
            # 약간의 여유를 두어 다운로드 (편집을 위해)
            cmd.extend([
                '--external-downloader', 'ffmpeg',
                '--external-downloader-args', 
                f'ffmpeg_i:-ss {start_time} -t {duration + 5}'
            ])
        
        cmd.append(url)
        
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

def cleanup_full_download(audio_path: str):
    """전체 다운로드 파일 삭제"""
    try:
        if os.path.exists(audio_path):
            os.remove(audio_path)
            print(f"전체 파일 삭제됨: {audio_path}")
    except Exception as e:
        print(f"파일 삭제 실패 {audio_path}: {e}")

def clean_filename(filename: str) -> str:
    """파일명에서 특수문자 제거"""
    # 특수문자를 언더스코어로 치환
    clean = re.sub(r'[^\w\s-]', '_', filename)
    # 공백을 언더스코어로 치환
    clean = re.sub(r'[-\s]+', '_', clean)
    return clean.strip('_').lower()

def extract_metadata(audio_path: str) -> Dict[str, Any]:
    """오디오 파일에서 메타데이터 추출 (원본 YouTube 제목 사용)"""
    try:
        audio = MP3(audio_path)
        
        title = str(audio.get('TIT2', ['Unknown'])[0]) if audio.get('TIT2') else "Unknown"
        album = str(audio.get('TALB', ['Unknown'])[0]) if audio.get('TALB') else "Unknown"
        
        # 파일명에서 정보 추출 (메타데이터가 없는 경우 - 원본 제목 사용)
        if title == "Unknown":
            title = Path(audio_path).stem  # 원본 YouTube 제목 그대로 사용
        
        return {
            'title': title,
            'album': album
        }
    except (ID3NoHeaderError, Exception):
        # 메타데이터 없는 경우 파일명을 원본 제목으로 사용
        basename = Path(audio_path).stem
        return {
            'title': basename,  # 원본 YouTube 제목 그대로 사용
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

# quiz.json 관련 함수들은 제거됨 - 이제 Supabase 데이터베이스를 사용

def print_progress(current: int, total: int, step: str, song_title: str = "", start_time: float = None):
    """진행률 출력 (스레드 안전)"""
    percentage = (current / total) * 100 if total > 0 else 0
    
    progress_info = {
        "type": "progress",
        "current": current,
        "total": total,
        "percentage": round(percentage, 1),
        "step": step,
        "song_title": song_title,
        "current_video_title": song_title,
        "processing_stage": step,
        "remaining_count": max(0, total - current),
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

def print_enhanced_progress(current: int, total: int, step: str, song_title: str = "", start_time: float = None):
    """향상된 진행률 출력 (완료된 비디오 목록 및 활성 작업자 포함)"""
    percentage = (current / total) * 100 if total > 0 else 0
    
    # 기본 진행률 정보
    progress_info = {
        "type": "progress",
        "current": current,
        "total": total,
        "percentage": round(percentage, 1),
        "step": step,
        "song_title": song_title,
        "current_video_title": song_title,
        "processing_stage": step,
        "remaining_count": max(0, total - current),
        "timestamp": datetime.now().isoformat()
    }
    
    # 시간 추정 정보 추가
    if start_time:
        elapsed = time.time() - start_time
        if current > 0:
            avg_time_per_song = elapsed / current
            remaining = (total - current) * avg_time_per_song
            progress_info["estimated_remaining_seconds"] = round(remaining)
            progress_info["estimated_remaining_minutes"] = round(remaining / 60, 1)
    
    # 진행률 추적기에서 추가 정보 가져오기
    tracker_data = progress_tracker.get_progress_data()
    progress_info.update(tracker_data)
    
    print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
    
    # 사람이 읽기 쉬운 형태로도 출력
    eta_str = ""
    if "estimated_remaining_minutes" in progress_info:
        eta_str = f" (예상 남은 시간: {progress_info['estimated_remaining_minutes']}분)"
    
    print(f"[{current}/{total}] {step}: {song_title} ({percentage:.1f}%){eta_str}")

def print_parallel_progress(completed: int, total: int, successful: int, failed: int, current_song: str = ""):
    """병렬 처리 전용 진행률 출력 (향상된 정보 포함)"""
    percentage = (completed / total) * 100 if total > 0 else 0
    
    progress_info = {
        "type": "parallel_progress",
        "completed": completed,
        "current": completed,
        "total": total,
        "successful": successful,
        "failed": failed,
        "percentage": round(percentage, 1),
        "current_song": current_song,
        "current_video_title": current_song,
        "processing_stage": "병렬 처리 중",
        "remaining_count": max(0, total - completed),
        "timestamp": datetime.now().isoformat()
    }
    
    # 진행률 추적기에서 추가 정보 가져오기
    tracker_data = progress_tracker.get_progress_data()
    progress_info.update(tracker_data)
    
    print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
    print(f"[{completed}/{total}] 병렬 처리 중 - 성공: {successful}, 실패: {failed} ({percentage:.1f}%)")

def get_user_settings():
    """사용자 설정 로드 (기본값 포함)"""
    settings = {
        "clip_duration": 10,  # 기본값 10초 (최대 제한)
        "clip_start_offset": 30,  # 기본값 30초 지점에서 시작
        "cleanup_full_downloads": True,  # 클립 생성 후 전체 파일 삭제
        "download_only_clip_duration": False,  # 전체 다운로드 대신 클립 길이만 다운로드
        "parallel_processing": True,  # 병렬 처리 활성화
        "max_workers": MAX_WORKERS  # 최대 동시 작업 수
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
    
    # 클립 길이 최대 10초로 제한
    if settings["clip_duration"] > 10:
        print(f"클립 길이가 최대값 10초로 제한됩니다. (설정값: {settings['clip_duration']}초)")
        settings["clip_duration"] = 10
    
    # 병렬 처리 작업자 수 제한 (1-5 사이)
    if settings["max_workers"] < 1:
        settings["max_workers"] = 1
    elif settings["max_workers"] > 5:
        print(f"최대 작업자 수가 5개로 제한됩니다. (설정값: {settings['max_workers']}개)")
        settings["max_workers"] = 5
    
    return settings

def process_urls_parallel(urls: List[str], user_settings: Dict[str, Any] = None):
    """URL 목록을 병렬로 처리 (성능 최적화)"""
    if user_settings is None:
        user_settings = get_user_settings()
    
    all_songs_data = []
    start_time = time.time()
    
    # 플레이리스트 확장
    original_urls = urls[:]
    expanded_urls = []
    
    print("=== 플레이리스트 확장 중... ===")
    
    # 진행률 정보 출력 (플레이리스트 확장 시작)
    progress_info = {
        "type": "playlist_expansion",
        "status": "starting",
        "message": "플레이리스트에서 비디오 목록을 가져오고 있습니다...",
        "timestamp": datetime.now().isoformat()
    }
    print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
    
    for i, url in enumerate(original_urls, 1):
        if is_playlist_url(url):
            progress_info = {
                "type": "playlist_processing",
                "current_playlist": i,
                "total_playlists": len(original_urls),
                "message": f"플레이리스트 {i}/{len(original_urls)} 처리 중...",
                "timestamp": datetime.now().isoformat()
            }
            print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
            
            individual_urls = extract_playlist_urls(url)
            expanded_urls.extend(individual_urls)
            print(f"플레이리스트에서 {len(individual_urls)}개 비디오 발견")
        else:
            expanded_urls.append(url)
    
    total_songs = len(expanded_urls)
    print(f"총 {total_songs}개 곡 병렬 처리 시작 (최대 {MAX_WORKERS}개 동시 처리)")
    
    # 정확한 총 개수로 진행률 시작
    progress_info = {
        "type": "processing_start",
        "total_songs": total_songs,
        "message": f"총 {total_songs}개 곡을 병렬로 다운로드 및 클립 생성합니다 (최대 {MAX_WORKERS}개 동시 처리)",
        "timestamp": datetime.now().isoformat()
    }
    print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
    
    # 병렬 처리 실행
    successful_results = []
    failed_results = []
    completed_count = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 모든 작업을 제출
        future_to_url = {
            executor.submit(process_single_url, url, i, total_songs, user_settings, start_time): (url, i)
            for i, url in enumerate(expanded_urls, 1)
        }
        
        # 완료된 작업들을 처리
        for future in as_completed(future_to_url):
            url, index = future_to_url[future]
            completed_count += 1
            
            try:
                result = future.result()
                
                if result.success:
                    successful_results.append(result)
                    all_songs_data.append(result.song_data)
                    
                    # 성공 로그
                    with PROGRESS_LOCK:
                        print(f"✓ [{completed_count}/{total_songs}] 성공: {result.song_data['title']} ({result.processing_time:.1f}초)")
                else:
                    failed_results.append(result)
                    
                    # 실패 로그
                    with PROGRESS_LOCK:
                        print(f"✗ [{completed_count}/{total_songs}] 실패: {result.error} ({result.processing_time:.1f}초)")
                
                # 중간 진행률 업데이트
                if completed_count % 5 == 0 or completed_count == total_songs:
                    with PROGRESS_LOCK:
                        progress_info = {
                            "type": "batch_progress",
                            "completed": completed_count,
                            "current": completed_count,
                            "total": total_songs,
                            "successful": len(successful_results),
                            "failed": len(failed_results),
                            "percentage": round((completed_count / total_songs) * 100, 1),
                            "processing_stage": "병렬 처리 중",
                            "remaining_count": max(0, total_songs - completed_count),
                            "message": f"병렬 처리 진행 중: {completed_count}/{total_songs} 완료 (성공: {len(successful_results)}, 실패: {len(failed_results)})",
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # 진행률 추적기에서 추가 정보 가져오기
                        tracker_data = progress_tracker.get_progress_data()
                        progress_info.update(tracker_data)
                        
                        print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
                        
            except Exception as e:
                failed_results.append(ProcessingResult(
                    success=False,
                    url=url,
                    error=f"작업 실행 오류: {str(e)}"
                ))
                completed_count += 1
                
                with PROGRESS_LOCK:
                    print(f"✗ [{completed_count}/{total_songs}] 작업 실행 오류: {str(e)}")
    
    # 처리 완료 통계
    total_time = time.time() - start_time
    success_count = len(successful_results)
    failure_count = len(failed_results)
    
    print(f"\n=== 병렬 처리 완료 ===")
    print(f"총 처리 시간: {total_time:.1f}초")
    print(f"성공: {success_count}개")
    print(f"실패: {failure_count}개")
    
    if successful_results:
        avg_time = sum(r.processing_time for r in successful_results) / len(successful_results)
        print(f"평균 처리 시간: {avg_time:.1f}초/곡")
    
    # 실패한 항목들 상세 로그
    if failed_results:
        print(f"\n실패한 항목들:")
        for result in failed_results[:5]:  # 최대 5개만 표시
            print(f"  - {result.url}: {result.error}")
        if len(failed_results) > 5:
            print(f"  ... 및 {len(failed_results) - 5}개 더")
    
    # 최종 완료 메시지
    if all_songs_data:
        progress_info = {
            "type": "completion",
            "total_processed": len(all_songs_data),
            "total_failed": failure_count,
            "successful": len(all_songs_data),
            "failed": failure_count,
            "processing_time": round(total_time, 1),
            "current": total_songs,
            "total": total_songs,
            "percentage": 100.0,
            "processing_stage": "완료",
            "remaining_count": 0,
            "message": f"병렬 처리 완료! 총 {len(all_songs_data)}개 클립 생성 성공 ({failure_count}개 실패)",
            "timestamp": datetime.now().isoformat()
        }
        
        # 최종 완료된 비디오 목록 포함
        tracker_data = progress_tracker.get_progress_data()
        progress_info.update(tracker_data)
        
        print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
        print(f"총 {len(all_songs_data)}개 노래 처리 완료!")
    else:
        progress_info = {
            "type": "completion",
            "total_processed": 0,
            "total_failed": failure_count,
            "successful": 0,
            "failed": failure_count,
            "processing_time": round(total_time, 1),
            "current": total_songs,
            "total": total_songs,
            "percentage": 100.0,
            "processing_stage": "완료 (실패)",
            "remaining_count": 0,
            "message": "처리된 노래가 없습니다.",
            "timestamp": datetime.now().isoformat()
        }
        
        # 실패한 비디오 목록 포함
        tracker_data = progress_tracker.get_progress_data()
        progress_info.update(tracker_data)
        
        print(f"PROGRESS: {json.dumps(progress_info, ensure_ascii=False)}")
        print("처리된 노래가 없습니다.")

def process_urls(urls: List[str], user_settings: Dict[str, Any] = None):
    """URL 목록 처리 (병렬 처리 버전으로 리다이렉트)"""
    return process_urls_parallel(urls, user_settings)

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
    
    # 성능 로깅 초기화
    session_id = f"session_{int(time.time())}_{os.getpid()}"
    user_id = os.path.basename(urls_file).replace('.txt', '').replace('temp_urls_', '')
    
    try:
        performance_logger = init_performance_logger(session_id, user_id)
        print(f"성능 로깅 시작: 세션 ID {session_id}, 사용자 ID {user_id}")
    except Exception as e:
        print(f"성능 로깅 초기화 실패 (계속 진행): {e}")
    
    # 디렉토리 생성
    ensure_directories()
    
    # 사용자 설정 로드
    user_settings = get_user_settings()
    parallel_status = "활성화" if user_settings['parallel_processing'] else "비활성화"
    print(f"사용자 설정: 클립 길이 {user_settings['clip_duration']}초, 시작 지점 {user_settings['clip_start_offset']}초")
    print(f"병렬 처리: {parallel_status} (최대 {user_settings['max_workers']}개 동시 작업)")
    
    # 전역 MAX_WORKERS 업데이트
    global MAX_WORKERS
    MAX_WORKERS = user_settings['max_workers']
    
    try:
        # URL 처리
        if user_settings['parallel_processing']:
            process_urls_parallel(urls, user_settings)
        else:
            # 순차 처리 (기존 방식) - 필요시 구현
            print("순차 처리 모드는 현재 병렬 처리로 대체되었습니다.")
            process_urls_parallel(urls, user_settings)
    finally:
        # 성능 로깅 종료
        try:
            session_performance = finalize_performance_logging()
            if session_performance:
                print(f"성능 로깅 완료: 총 {len(session_performance.steps)}개 단계 기록됨")
        except Exception as e:
            print(f"성능 로깅 종료 중 오류 (무시): {e}")

if __name__ == "__main__":
    main()