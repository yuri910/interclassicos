export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      editions: {
        Row: {
          created_at: string
          foul_shootout_limit: number
          games_to_reset_yellows: number
          id: string
          is_active: boolean
          name: string
          ouro_qualifiers: number
          prata_qualifiers: number
          suspension_games_red: number
          suspension_games_yellow: number
          team_count: number
          updated_at: string
          year: number
          yellows_for_suspension: number
        }
        Insert: {
          created_at?: string
          foul_shootout_limit?: number
          games_to_reset_yellows?: number
          id?: string
          is_active?: boolean
          name: string
          ouro_qualifiers?: number
          prata_qualifiers?: number
          suspension_games_red?: number
          suspension_games_yellow?: number
          team_count?: number
          updated_at?: string
          year?: number
          yellows_for_suspension?: number
        }
        Update: {
          created_at?: string
          foul_shootout_limit?: number
          games_to_reset_yellows?: number
          id?: string
          is_active?: boolean
          name?: string
          ouro_qualifiers?: number
          prata_qualifiers?: number
          suspension_games_red?: number
          suspension_games_yellow?: number
          team_count?: number
          updated_at?: string
          year?: number
          yellows_for_suspension?: number
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          match_id: string
          minute: number | null
          player_id: string
          team_id: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_id: string
          minute?: number | null
          player_id: string
          team_id: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_id?: string
          minute?: number | null
          player_id?: string
          team_id?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_fouls: {
        Row: {
          count: number
          created_at: string
          half: number
          id: string
          match_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          half: number
          id?: string
          match_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          half?: number
          id?: string
          match_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_fouls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_fouls_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number
          away_team_id: string | null
          created_at: string
          edition_id: string | null
          field: string
          group_name: string | null
          home_score: number
          home_team_id: string | null
          id: string
          kickoff_at: string
          mvp_player_id: string | null
          phase: Database["public"]["Enums"]["match_phase"]
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          away_score?: number
          away_team_id?: string | null
          created_at?: string
          edition_id?: string | null
          field: string
          group_name?: string | null
          home_score?: number
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          mvp_player_id?: string | null
          phase?: Database["public"]["Enums"]["match_phase"]
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          away_score?: number
          away_team_id?: string | null
          created_at?: string
          edition_id?: string | null
          field?: string
          group_name?: string | null
          home_score?: number
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          mvp_player_id?: string | null
          phase?: Database["public"]["Enums"]["match_phase"]
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_mvp_player_id_fkey"
            columns: ["mvp_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          shirt_number: number | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          shirt_number?: number | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          shirt_number?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          crest_emoji: string | null
          edition_id: string | null
          group_name: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          crest_emoji?: string | null
          edition_id?: string | null
          group_name?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          crest_emoji?: string | null
          edition_id?: string | null
          group_name?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "mesario"
      event_type: "gol" | "amarelo" | "vermelho"
      match_phase:
        | "grupos"
        | "oitavas"
        | "quartas"
        | "semi"
        | "final"
        | "terceiro"
      match_status: "agendada" | "em_andamento" | "encerrada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "mesario"],
      event_type: ["gol", "amarelo", "vermelho"],
      match_phase: [
        "grupos",
        "oitavas",
        "quartas",
        "semi",
        "final",
        "terceiro",
      ],
      match_status: ["agendada", "em_andamento", "encerrada"],
    },
  },
} as const
