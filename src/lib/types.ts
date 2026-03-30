export type EventRole = "host" | "member";
export type EventTab = "eat" | "bring" | "shop";

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string | null;
  share_code: string;
  host_id: string;
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
