export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type EventStatus = "active" | "archived";
type EventRole = "host" | "member";
type InvitationStatus = "pending" | "accepted" | "revoked";
type ActivityAction = "insert" | "update" | "delete";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_path: string | null;
          avatar_mime_type: string | null;
          avatar_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_path?: string | null;
          avatar_mime_type?: string | null;
          avatar_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_path?: string | null;
          avatar_mime_type?: string | null;
          avatar_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          location: string | null;
          event_date: string | null;
          share_code: string;
          status: EventStatus;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          description?: string | null;
          location?: string | null;
          event_date?: string | null;
          share_code: string;
          status?: EventStatus;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          title?: string;
          description?: string | null;
          location?: string | null;
          event_date?: string | null;
          share_code?: string;
          status?: EventStatus;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_members: {
        Row: {
          event_id: string;
          user_id: string;
          role: EventRole;
          joined_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          role: EventRole;
          joined_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          role?: EventRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      catalog_items: {
        Row: {
          id: string;
          category: string | null;
          label: string;
          unit: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category?: string | null;
          label: string;
          unit: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          category?: string | null;
          label?: string;
          unit?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      eat_selections: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          label: string;
          category: string | null;
          unit: string;
          quantity: number;
          catalog_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          label: string;
          category?: string | null;
          unit: string;
          quantity: number;
          catalog_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          label?: string;
          category?: string | null;
          unit?: string;
          quantity?: number;
          catalog_item_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bring_items: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          label: string;
          category: string | null;
          unit: string;
          quantity: number;
          catalog_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          label: string;
          category?: string | null;
          unit: string;
          quantity: number;
          catalog_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          label?: string;
          category?: string | null;
          unit?: string;
          quantity?: number;
          catalog_item_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shopping_additions: {
        Row: {
          id: string;
          event_id: string;
          label: string;
          unit: string;
          quantity: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          label: string;
          unit: string;
          quantity: number;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          label?: string;
          unit?: string;
          quantity?: number;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      event_activity_log: {
        Row: {
          id: string;
          event_id: string;
          actor_user_id: string | null;
          actor_name: string | null;
          entity_type: string;
          entity_id: string | null;
          action: ActivityAction;
          summary: string;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          actor_user_id?: string | null;
          actor_name?: string | null;
          entity_type: string;
          entity_id?: string | null;
          action: ActivityAction;
          summary: string;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          actor_user_id?: string | null;
          actor_name?: string | null;
          entity_type?: string;
          entity_id?: string | null;
          action?: ActivityAction;
          summary?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_invitations: {
        Row: {
          id: string;
          event_id: string;
          email: string;
          status: InvitationStatus;
          message: string | null;
          invited_by: string;
          accepted_by: string | null;
          invited_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          email: string;
          status?: InvitationStatus;
          message?: string | null;
          invited_by: string;
          accepted_by?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          email?: string;
          status?: InvitationStatus;
          message?: string | null;
          invited_by?: string;
          accepted_by?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      platform_user_bans: {
        Row: {
          user_id: string;
          reason: string | null;
          banned_by: string | null;
          banned_at: string;
          lifted_by: string | null;
          lifted_at: string | null;
        };
        Insert: {
          user_id: string;
          reason?: string | null;
          banned_by?: string | null;
          banned_at?: string;
          lifted_by?: string | null;
          lifted_at?: string | null;
        };
        Update: {
          user_id?: string;
          reason?: string | null;
          banned_by?: string | null;
          banned_at?: string;
          lifted_by?: string | null;
          lifted_at?: string | null;
        };
        Relationships: [];
      };
      notification_categories: {
        Row: {
          key: string;
          label: string;
          sort_order: number;
          default_in_app: boolean;
          default_email: boolean;
          default_push: boolean;
        };
        Insert: {
          key: string;
          label: string;
          sort_order?: number;
          default_in_app?: boolean;
          default_email?: boolean;
          default_push?: boolean;
        };
        Update: {
          key?: string;
          label?: string;
          sort_order?: number;
          default_in_app?: boolean;
          default_email?: boolean;
          default_push?: boolean;
        };
        Relationships: [];
      };
      user_notification_preferences: {
        Row: {
          user_id: string;
          category: string;
          in_app_enabled: boolean;
          email_enabled: boolean;
          push_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          category: string;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          push_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          category?: string;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          push_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_get_overview_stats: {
        Args: Record<string, never>;
        Returns: {
          total_events: number;
          active_events: number;
          archived_events: number;
          total_accounts: number;
          banned_accounts: number;
          average_members_per_event: number;
          pending_invitations: number;
        }[];
      };
      admin_list_account_events: {
        Args: { p_user_id: string };
        Returns: {
          event_id: string;
          title: string;
          share_code: string;
          event_date: string | null;
          status: EventStatus;
          role: EventRole;
          location: string | null;
          joined_at: string;
        }[];
      };
      admin_list_accounts: {
        Args: { p_search?: string | null };
        Returns: {
          user_id: string;
          email: string | null;
          display_name: string;
          created_at: string;
          is_platform_admin: boolean;
          is_banned: boolean;
          ban_reason: string | null;
          banned_at: string | null;
          hosted_events: number;
          member_events: number;
          pending_invitations: number;
        }[];
      };
      admin_list_events: {
        Args: { p_search?: string | null };
        Returns: {
          id: string;
          title: string;
          description: string | null;
          location: string | null;
          event_date: string | null;
          share_code: string;
          host_id: string;
          host_name: string;
          host_email: string | null;
          status: EventStatus;
          member_count: number;
          created_at: string;
        }[];
      };
      admin_set_user_ban: {
        Args: {
          p_user_id: string;
          p_banned?: boolean;
          p_reason?: string | null;
        };
        Returns: string;
      };
      archive_event: {
        Args: {
          p_event_id: string;
          p_archived?: boolean;
        };
        Returns: string;
      };
      create_event: {
        Args: {
          p_title: string;
          p_event_date?: string | null;
          p_location?: string | null;
          p_description?: string | null;
        };
        Returns: string;
      };
      create_event_invitation: {
        Args: {
          p_event_id: string;
          p_email: string;
          p_message?: string | null;
        };
        Returns: string;
      };
      duplicate_event: {
        Args: {
          p_event_id: string;
          p_title?: string | null;
        };
        Returns: string;
      };
      get_event_activity_log: {
        Args: { p_event_id: string };
        Returns: Database["public"]["Tables"]["event_activity_log"]["Row"][];
      };
      get_event_invitations: {
        Args: { p_event_id: string };
        Returns: {
          id: string;
          event_id: string;
          email: string;
          status: InvitationStatus;
          message: string | null;
          invited_by: string;
          invited_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          accepted_by: string | null;
          accepted_user_name: string | null;
        }[];
      };
      get_event_members: {
        Args: { p_event_id: string };
        Returns: {
          user_id: string;
          role: EventRole;
          display_name: string;
          email: string | null;
          avatar_path: string | null;
          joined_at: string;
        }[];
      };
      ensure_user_notification_preferences: {
        Args: { p_user_id?: string };
        Returns: undefined;
      };
      get_session_flags: {
        Args: Record<string, never>;
        Returns: {
          is_platform_admin: boolean;
          is_banned: boolean;
        }[];
      };
      get_shopping_remaining: {
        Args: { p_event_id: string };
        Returns: {
          label: string;
          category: string | null;
          unit: string;
          needed: number;
          brought: number;
          remaining: number;
        }[];
      };
      is_active_platform_user: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      is_event_active: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
      is_event_host: {
        Args: {
          p_event_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_event_member: {
        Args: {
          p_event_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_platform_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      is_user_banned: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      join_event_by_code: {
        Args: { p_code: string };
        Returns: string;
      };
      revoke_event_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      transfer_event_host: {
        Args: {
          p_event_id: string;
          p_new_host_user_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
