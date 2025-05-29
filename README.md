# 🎵 Music Quiz App

A fun and interactive quiz app built with **Electron** (or responsive web fallback) that allows users to guess songs from short audio snippets sourced from their **Spotify** or **YouTube** playlists.

---

## 🚀 Features

### 🔐 OAuth Login

- Login via **Spotify** and **YouTube** using **OAuth 2.0**
- Secure access to user playlists

### 📥 Playlist Import

- Users can import their playlists from supported platforms
- Song metadata and audio previews (if available) are extracted for quiz use

### 🎮 Quiz Gameplay

- Play 1–5 second audio snippets from imported songs
- Present 4 multiple-choice options per question
- Player selects the correct song title from the options
- Score is tracked and displayed

### ⚙️ Customizable Settings

- Users can choose snippet duration (1–5 seconds)
- Settings apply per quiz session

### 🔗 Shareable Games

- Generate a shareable link after creating a game
- Friends can access and play the quiz via the shared link

### 🏠 Main Interface

- Create new quiz from playlists
- View list of created or joined games

---

## 📱 Responsiveness

If Electron is not supported (e.g., mobile browsers), the application gracefully degrades into a fully responsive **web experience** using:

- Tailwind CSS or equivalent
- Media queries and adaptive layouts

---

## 🛠 Tech Stack

| Category         | Stack                                              |
| ---------------- | -------------------------------------------------- |
| Framework        | [Electron](https://www.electronjs.org/) or Next.js |
| Auth             | OAuth 2.0 (Spotify & YouTube)                      |
| UI Library       | React / Tailwind CSS                               |
| Playback Support | Spotify Web Playback SDK / YouTube Iframe API      |
| State Management | React Context / Zustand / Redux Toolkit            |

---

## 🗂 Folder Structure (Example)
