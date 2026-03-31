export type EventRole = "host" | "member";
export type EventStatus = "active" | "archived";
export type InvitationStatus = "pending" | "accepted" | "revoked";
export type EventTab = "eat" | "bring" | "shop" | "activity" | "manage";

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string | null;
  share_code: string;
  host_id: string;
  status: EventStatus;
  archived_at: string | null;
  created_at: string;
};

export type CatalogItem = {
  id: string;
  label: string;
  category: string | null;
  unit: string;
  sort_order?: number;
};

export type MemberDirectoryItem = {
  user_id: string;
  role: EventRole;
  display_name: string;
  email: string | null;
  joined_at: string;
};

export type ChoiceRow = {
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

export type ShoppingAddition = {
  id: string;
  event_id: string;
  label: string;
  unit: string;
  quantity: number;
  created_by: string;
  created_at: string;
};

export type ShoppingRemainingRow = {
  label: string;
  category: string | null;
  unit: string;
  needed: number;
  brought: number;
  remaining: number;
};

export type ActivityLogRow = {
  id: string;
  event_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: "insert" | "update" | "delete";
  summary: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

export type AdminEventOverview = {
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
};

export type EventInvitation = {
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
};
