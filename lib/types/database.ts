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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'designer' | 'admin'
          avatar_path: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'designer' | 'admin'
          avatar_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'designer' | 'admin'
          avatar_path?: string | null
          created_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          user_id: string
          submission_date: string
          comment: string | null
          is_completed: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          submission_date?: string
          comment?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          submission_date?: string
          comment?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      assets: {
        Row: {
          id: string
          submission_id: string
          storage_path: string
          file_name: string
          file_size: number | null
          asset_type: 'image' | 'video'
          duration: number | null
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          storage_path: string
          file_name: string
          file_size?: number | null
          asset_type?: 'image' | 'video'
          duration?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          storage_path?: string
          file_name?: string
          file_size?: number | null
          asset_type?: 'image' | 'video'
          duration?: number | null
          created_at?: string
        }
      }
      asset_reviews: {
        Row: {
          id: string
          asset_id: string
          reviewer_id: string
          stars: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          reviewer_id: string
          stars: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          reviewer_id?: string
          stars?: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ratings: {
        Row: {
          id: string
          submission_id: string
          rated_by: string
          productivity: number
          quality: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          rated_by: string
          productivity: number
          quality: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          rated_by?: string
          productivity?: number
          quality?: number
          comment?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: {
          time_range?: string
          week_offset?: number
          target_date?: string
        }
        Returns: {
          user_id: string
          full_name: string | null
          total_submissions: number
          avg_total_score: number
          avg_productivity: number
          avg_quality: number
          cumulative_total_score: number
          rank: number
          static_count: number
          video_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Submission = Database['public']['Tables']['submissions']['Row']
export type Asset = Database['public']['Tables']['assets']['Row']
export type Rating = Database['public']['Tables']['ratings']['Row']

export type SubmissionWithAssets = Submission & {
  assets: Asset[]
}

export type SubmissionWithDetails = Submission & {
  assets: Asset[]
  profiles: Pick<Profile, 'full_name' | 'email'>
  ratings: (Rating & { profiles: Pick<Profile, 'full_name'> })[]
}

export type AppStatus = 'active' | 'beta' | 'maintenance' | 'hidden'

export type App = {
  id: string
  name: string
  slug: string
  description: string | null
  url: string
  icon_url: string | null
  status: AppStatus
  display_order: number
  open_in_new_tab: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

export type AiSummaryType = 'judge_context' | 'designer_feedback' | 'admin_weekly'

export type AiSummary = {
  id: string
  type: AiSummaryType
  target_user_id: string
  generated_by: string | null
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export type TimeAllocation = {
  id: string
  user_id: string
  allocation_date: string
  allocation: '0-30' | '30-70' | '70-100'
  created_at: string
}

export type LeaderboardEntry = {
  user_id: string
  full_name: string | null
  avatar_path?: string | null
  total_submissions: number
  avg_total_score: number
  avg_productivity: number
  avg_quality: number
  cumulative_total_score?: number
  rank: number
  trend?: 'up' | 'down' | 'same'
  avg_score_delta?: number
  last_day_added?: number
  static_count?: number
  video_count?: number
  daily_static_count?: number
  daily_video_count?: number
  daily_avg_productivity?: number
  daily_avg_quality?: number
  daily_avg_total?: number
  cumulative_productivity?: number
  cumulative_quality?: number
}
