#!/bin/bash
# WhatsThatTune 설정 스크립트

echo "🎵 WhatsThatTune 설정을 시작합니다..."

# Python 가상환경 생성
if [ ! -d "venv" ]; then
    echo "Python 가상환경 생성 중..."
    python3 -m venv venv
fi

# 가상환경 활성화
source venv/bin/activate

# 패키지 설치
echo "필요한 패키지 설치 중..."
pip install -r requirements.txt

# yt-dlp 설치 확인
if ! command -v yt-dlp &> /dev/null; then
    echo "yt-dlp 설치 중..."
    pip install yt-dlp
fi

echo "✅ 설정 완료!"
echo ""
echo "사용법:"
echo "1. scripts/urls.txt 파일에 YouTube URL들을 입력"
echo "2. ./process_music.sh 실행"
echo ""
echo "또는 개별 실행:"
echo "- python create_clips.py urls.txt  # 음악 다운로드 및 클립 생성"
echo "- python generate_quiz.py          # 퀴즈 생성"