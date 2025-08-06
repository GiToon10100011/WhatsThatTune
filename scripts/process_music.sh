#!/bin/bash
# 음악 처리 및 퀴즈 생성 통합 스크립트

cd "$(dirname "$0")"

# 가상환경 활성화
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "가상환경이 없습니다. setup.sh를 먼저 실행하세요."
    exit 1
fi

# URLs 파일 확인
if [ ! -f "urls.txt" ]; then
    echo "urls.txt 파일을 생성하고 YouTube URL들을 입력하세요."
    echo ""
    echo "예시:"
    echo "https://www.youtube.com/watch?v=fJ9rUzIMcZQ"
    echo "https://www.youtube.com/watch?v=DyDfgMOUjCI"
    echo "https://www.youtube.com/playlist?list=PLxxx..."
    touch urls.txt
    exit 1
fi

echo "🎵 음악 처리를 시작합니다..."

# 1단계: 음악 다운로드 및 클립 생성
echo "1단계: 음악 다운로드 및 클립 생성..."
python create_clips.py urls.txt

if [ $? -ne 0 ]; then
    echo "❌ 음악 처리 실패"
    exit 1
fi

# 2단계: 자동 퀴즈 생성
echo ""
echo "2단계: 샘플 퀴즈 자동 생성..."
python generate_quiz.py --auto

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 모든 처리가 완료되었습니다!"
    echo "이제 웹 앱에서 퀴즈를 플레이할 수 있습니다."
else
    echo "❌ 퀴즈 생성 실패"
    exit 1
fi