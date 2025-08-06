🎯 프로젝트 기획서
프로젝트명: WhatsThatTune

유튜브 음악을 일부 클립으로 재생하고, 사용자가 곡 제목을 맞히는 음악 퀴즈 웹 앱

🧩 1. 핵심 개요

| 항목    | 내용                                 |
| ----- | ---------------------------------- |
| 목적    | 유튜브 음악을 기반으로 한 개인용 음악 퀴즈 생성기       |
| 주요 기능 | 유튜브에서 오디오 클립 자동 추출 + 퀴즈 웹 앱 생성     |
| 대상    | 나 자신 + 친구 몇 명에게 zip 공유             |
| 사용 환경 | 로컬 컴퓨터에서 실행 (브라우저에서 index.html 열기) |

🧱 2. 전체 구조 구성

📁 clipquiz/
│
├─ 📁 downloads/         ← yt-dlp로 저장된 전체 MP3
├─ 📁 clips/             ← 잘라낸 클립 (10~15초)
├─ 📁 frontend/            ← Next.js 프론트엔드 디렉토리
│   ├─ index.html
│   ├─ script.js
│   └─ style.css
├─ 📁 data/
│   └─ quiz.json         ← 문제/보기/정답/클립 경로
├─ create_clips.py       ← 자동화 스크립트
└─ generate_quiz.py      ← JSON 퀴즈 생성기 (Claude 연동 가능)

⚙️ 3. 기능 세부 설계
✅ A. 유튜브 오디오 다운로드 (yt-dlp 사용)
사용자가 유튜브 링크 여러 개를 텍스트로 입력

Python으로 자동 다운로드

yt-dlp -x --audio-format mp3 -o "downloads/%(title)s.%(ext)s" <URL>

파일명: "Coldplay - Fix You.mp3" 등으로 저장됨

OR

가능하다면, 플레이리스트 주소를 넣으면 해당 곡들 제목만 추출/곡의 url추출해서 더 간편한 자동화 시스템을 만들어 누구나 사용할 수 있도록 하기 (보안 걱정은 안해도 됨, 어차피 지인들과 나만 사용할 웹사이트임.)

✅ B. 클립 자동 추출 (Python + pydub)
원하는 시작 시간과 길이 설정 (예: 30~45초)

파일 이름 기준으로 클립 추출

from pydub import AudioSegment

audio = AudioSegment.from_mp3("downloads/Fix You.mp3")
clip = audio[30000:45000]  # 30s~45s
clip.export("clips/fix_you_clip.mp3", format="mp3")

이 작업을 일괄 자동화해서 "clips/..."에 저장

✅ C. 퀴즈 데이터 자동 생성 (Claude API 연동 or 수동 JSON)

1. 문제 문항 (question)
항상 "이 노래의 제목은?" 고정

2. 정답 (answer)
곡 제목 (예: "Fix You")

3. 오답(보기) 자동 생성 로직
정답을 제외한 다른 곡 제목들을 랜덤으로 뽑아서 옵션에 넣기

예시 JSON 구조 (자동 생성)

[
  {
    "clip": "clips/fix_you_clip.mp3",
    "question": "이 노래의 제목은?",
    "options": [
      "Fix You",         // 정답 포함
      "Viva La Vida",
      "Yellow",
      "Paradise"
    ],
    "answer": "Fix You"
  },
  ...
]

간단한 오답 생성 알고리즘 (Python 의사코드)

import random

def generate_options(correct_title, all_titles, n_options=4):
    # 정답 제외하고 랜덤 추출
    wrong_choices = [title for title in all_titles if title != correct_title]
    wrong_samples = random.sample(wrong_choices, n_options - 1)
    options = wrong_samples + [correct_title]
    random.shuffle(options)
    return options

적용할 때
전체 곡 제목 리스트를 미리 모아두고

클립마다 위 함수로 옵션 생성해서 JSON 파일에 저장

즉, 객관식으로, 전체 곡 목록 중 랜덤으로 따오고, 정답 하나 섞은 4지선다 문제임

📦 기술 스택

| 파트              | 기술                            |
| --------------- | ----------------------------- |
| 오디오 다운로드        | yt-dlp (CLI)                  |
| 오디오 클립 생성       | Python, pydub                 |
| 퀴즈 데이터          | JSON                          |
| 프론트엔드           | Next.js       |
| Claude API (선택) | Anthropic API + Python        |
| 서버 (옵션)         | Python `http.server` or Flask |

참고

현재 ui가 이미 전에 작업해둔게 있는데, 이 기획안에 맞게 수정하되, 기본 베이스 스타일링은 유지해서 수정하도록 하기. 