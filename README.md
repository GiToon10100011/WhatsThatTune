# 🎵 What's That Tune?

유튜브 음악을 기반으로 한 개인용 음악 퀴즈 생성기. YouTube URL에서 자동으로 오디오 클립을 생성하고 퀴즈를 만들어 음악 지식을 테스트할 수 있습니다.

---

## 🚀 주요 기능

### 🎬 YouTube 음악 import

- YouTube 개별 URL 또는 플레이리스트 URL 지원
- 자동으로 오디오 다운로드 및 10-15초 클립 생성
- 메타데이터 자동 추출 (제목, 아티스트, 앨범)

### 🎮 퀴즈 게임플레이

- 생성된 클립으로 객관식 퀴즈 플레이
- 난이도별 보기 수 조절 (Easy: 4개, Medium: 6개, Hard: 8개)
- 실시간 점수 추적 및 결과 표시

### ⚙️ 커스터마이징 가능한 설정

- 스니펫 재생 시간 조절
- 문제별 제한 시간 설정
- 다크/라이트 테마 지원

### 🏠 게임 관리

- 생성한 퀴즈 게임 목록 관리
- 로컬 저장으로 오프라인 플레이 가능

---

## 🛠 기술 스택

| 분야           | 기술                      |
| -------------- | ------------------------- |
| 프론트엔드     | Next.js 15, React 19     |
| UI 라이브러리  | shadcn/ui, Tailwind CSS  |
| 오디오 처리    | Python, yt-dlp, pydub    |
| 데이터 저장    | JSON 파일 기반            |
| 스타일링       | CSS Variables, 다크 테마  |

---

## 📁 프로젝트 구조

```
WhatsThatTune/
├── app/                    # Next.js App Router 페이지
│   ├── auth/              # YouTube URL 입력 페이지 
│   ├── create-game/       # 퀴즈 생성 페이지
│   ├── play/[id]/         # 게임 플레이 페이지
│   ├── quick-play/        # 빠른 플레이 모드
│   └── settings/          # 설정 페이지
├── components/            # 재사용 가능한 컴포넌트
├── lib/                   # 유틸리티 및 데이터 로직
├── public/
│   ├── clips/            # 생성된 오디오 클립들
│   ├── data/             # quiz.json (퀴즈 데이터)
│   └── downloads/        # 원본 오디오 파일들
├── scripts/               # Python 스크립트들
│   ├── create_clips.py   # YouTube 다운로드 & 클립 생성
│   ├── generate_quiz.py  # 퀴즈 자동 생성
│   ├── setup.sh          # 초기 설정 스크립트
│   └── process_music.sh  # 통합 실행 스크립트
└── CLAUDE.md             # 개발 가이드라인
```

---

## ✅ 설치 및 실행

### 1. 기본 설정

```bash
# 저장소 클론
git clone https://github.com/yourname/WhatsThatTune.git
cd WhatsThatTune

# Node.js 의존성 설치
npm install

# Python 환경 설정
cd scripts
./setup.sh
```

### 2. 음악 추가

```bash
# scripts/urls.txt에 YouTube URL 추가
echo "https://www.youtube.com/watch?v=fJ9rUzIMcZQ" >> scripts/urls.txt

# 음악 처리 실행 (다운로드 + 클립 생성 + 퀴즈 생성)
./process_music.sh
```

### 3. 웹 앱 실행

```bash
# 개발 서버 시작
npm run dev
```

http://localhost:3000 에서 앱 사용

---

## 🎯 사용 방법

1. **음악 Import**: `/auth` 페이지에서 YouTube URL 입력
2. **퀴즈 생성**: `/create-game`에서 원하는 곡들 선택하여 퀴즈 생성
3. **게임 플레이**: 생성된 퀴즈를 플레이하며 음악 지식 테스트
4. **설정 조정**: `/settings`에서 게임 설정 커스터마이징

---

## 🐍 Python 스크립트

### 직접 실행하기

```bash
cd scripts

# 1. 개별 URL 처리
python create_clips.py urls.txt

# 2. 대화형 퀴즈 생성
python generate_quiz.py

# 3. 자동 퀴즈 생성
python generate_quiz.py --auto
```

---

## 📦 필요 조건

- **Node.js** 18+ 
- **Python** 3.8+
- **yt-dlp** (자동 설치됨)
- **pydub** (자동 설치됨)

---

## 🔒 개인용 사용

이 앱은 개인용으로 설계되었으며 API 키나 외부 서비스 연동이 필요하지 않습니다. 모든 데이터는 로컬에 저장되어 오프라인에서도 작동합니다.

---

## 📄 라이센스

MIT
