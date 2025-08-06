import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          id: string
          is_public: boolean | null
          name: string
          question_count: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          id: string
          is_public?: boolean | null
          name: string
          question_count: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          question_count?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          game_id: string
          id: string
          options: Json
          order_index: number
          question: string
          song_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          game_id: string
          id: string
          options: Json
          order_index: number
          question: string
          song_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          game_id?: string
          id?: string
          options?: Json
          order_index?: number
          question?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album: string | null
          artist: string
          clip_end: number | null
          clip_path: string | null
          clip_start: number | null
          created_at: string | null
          created_by: string | null
          duration: number | null
          full_path: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          album?: string | null
          artist: string
          clip_end?: number | null
          clip_path?: string | null
          clip_start?: number | null
          created_at?: string | null
          created_by?: string | null
          duration?: number | null
          full_path?: string | null
          id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          album?: string | null
          artist?: string
          clip_end?: number | null
          clip_path?: string | null
          clip_start?: number | null
          created_at?: string | null
          created_by?: string | null
          duration?: number | null
          full_path?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      youtube_urls: {
        Row: {
          created_at: string | null
          created_by: string
          creator: string | null
          duration: number | null
          id: string
          processed: boolean | null
          title: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          creator?: string | null
          duration?: number | null
          id?: string
          processed?: boolean | null
          title?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          creator?: string | null
          duration?: number | null
          id?: string
          processed?: boolean | null
          title?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}