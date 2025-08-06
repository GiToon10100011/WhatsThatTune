# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

What's That Tune is a YouTube-based music quiz generator that automatically creates audio clips from YouTube URLs and generates interactive quizzes. Built as a Next.js web application with Python backend scripts for audio processing.

## Development Commands

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build the application for production 
- `npm start` - Start production server
- `npm run lint` - Run ESLint (note: currently disabled in build via next.config.mjs)

### Backend Scripts  
- `cd scripts && ./setup.sh` - Initialize Python environment
- `cd scripts && ./process_music.sh` - Process URLs and generate quiz
- `python scripts/create_clips.py urls.txt` - Download and create clips
- `python scripts/generate_quiz.py` - Generate quiz interactively
- `python scripts/generate_quiz.py --auto` - Auto-generate sample quiz

## Tech Stack & Architecture

- **Framework**: Next.js 15 with App Router
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme and animations
- **TypeScript**: Full TypeScript support with strict mode
- **Theme**: Dark/light mode support with next-themes
- **Audio Processing**: Python + yt-dlp + pydub for YouTube downloads and clip generation
- **Data Storage**: JSON-based local storage (no external APIs)

## Project Structure

- `app/` - Next.js App Router pages and layouts
  - `auth/` - YouTube URL input page (renamed from OAuth)
  - `create-game/` - Quiz creation from available songs
  - `play/[id]/` - Dynamic game playing interface with audio playback
  - `quick-play/` - Quick play mode with sample games
  - `settings/` - User settings and customization
  - `api/process-urls/` - API endpoint for Python script integration
- `components/` - Reusable React components
  - `ui/` - shadcn/ui components (accordion, button, card, etc.)
  - `theme-provider.tsx` - Theme context provider
  - `theme-toggle.tsx` - Dark/light mode toggle
- `lib/` - Utility functions and quiz data management
- `scripts/` - Python backend scripts
  - `create_clips.py` - YouTube download and clip generation
  - `generate_quiz.py` - Automated quiz generation
  - `setup.sh` / `process_music.sh` - Convenience scripts
- `public/clips/` - Generated 10-15 second audio clips
- `public/data/quiz.json` - Quiz data and available songs
- `public/downloads/` - Full audio files from YouTube

## Key Features Implementation

- **YouTube Processing**: Python scripts download audio, extract metadata, create clips
- **Quiz Generation**: Automatic multiple-choice question generation with configurable difficulty
- **Audio Playback**: Browser-based audio playback of generated clips
- **Local Storage**: Games stored in localStorage, quiz data in JSON files
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Theme System**: CSS variables-based theming with HSL color space

## Component Architecture

- Uses shadcn/ui component system with consistent design tokens
- Components are built with Radix UI primitives for accessibility
- Custom styling via Tailwind with CSS variables for theming
- All components use TypeScript interfaces for type safety

## Configuration Notes

- ESLint and TypeScript errors are ignored during builds (next.config.mjs)
- Images are set to unoptimized mode
- Tailwind configured with custom color palette and animations
- Path aliases configured: `@/*` maps to root directory
- Python virtual environment recommended for script isolation
- No external API keys or services required - fully self-contained

## Development Workflow

1. Add YouTube URLs to `scripts/urls.txt`
2. Run `./scripts/process_music.sh` to download and process music
3. Use web interface at `localhost:3000` to create and play quizzes
4. All data stored locally in `public/data/quiz.json` and `localStorage`