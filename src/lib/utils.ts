import type {
  ActivityLogRow,
  AdminOverviewStats,
  AdminEventOverview,
  AdminUserEvent,
  AdminUserOverview,
  CatalogItem,
  ChoiceRow,
  EventInvitation,
  EventSummary,
  MemberDirectoryItem,
  ShoppingAddition,
  ShoppingRemainingRow,
} from "./types";

type GroupableRow = Pick<ChoiceRow, "label" | "unit" | "quantity">;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return Boolean(value);
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export function friendlyErrorMessage(message: string) {
  if (message === "AUTH_REQUIRED") {
    return "Connexion requise.";
  }

  if (message === "TITLE_TOO_SHORT") {
    return "Le titre doit faire au moins 3 caracteres.";
  }

  if (message === "INVALID_CODE") {
    return "Code d invitation invalide.";
  }

  if (message === "EVENT_ARCHIVED") {
    return "Cet evenement est archive.";
  }

  if (message === "ACCESS_DENIED") {
    return "Action non autorisee.";
  }

  if (message === "ALREADY_MEMBER") {
    return "Cette personne fait deja partie de l evenement.";
  }

  if (message === "INVALID_EMAIL") {
    return "Adresse email invalide.";
  }

  if (message === "TARGET_NOT_MEMBER") {
    return "La personne choisie doit d abord rejoindre l evenement.";
  }

  if (message === "INVITATION_NOT_FOUND") {
    return "Invitation introuvable.";
  }

  if (message === "ADMIN_REQUIRED") {
    return "Acces reserve au super-admin.";
  }

  if (message === "USER_BANNED") {
    return "Ce compte est suspendu.";
  }

  if (message === "EVENT_NOT_FOUND") {
    return "Evenement introuvable.";
  }

  if (message === "ACCOUNT_NOT_FOUND") {
    return "Compte introuvable.";
  }

  if (message === "CANNOT_BAN_SELF") {
    return "Tu ne peux pas te bannir toi-meme.";
  }

  return message;
}

export function formatEventDate(value: string | null) {
  if (!value) {
    return "Date a definir";
  }

  return new Date(value).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatQuantity(value: number) {
  const rounded = Number(value);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1).replace(/\.0$/, "");
}

export function quantityStepForUnit(unit: string) {
  const lowered = unit.trim().toLowerCase();
  if (lowered === "g" || lowered === "cl") {
    return 10;
  }

  return 1;
}

export function buildShareLink(code: string) {
  if (typeof window === "undefined") {
    return `/join/${code}`;
  }

  return `${window.location.origin}/join/${code}`;
}

export function buildMailtoLink(email: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function splitDateTimeInput(value: string | null, fallbackTime = "19:00") {
  if (!value) {
    return {
      date: "",
      time: fallbackTime,
    };
  }

  const parsed = new Date(value);
  const offset = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - offset * 60_000);
  const localValue = localDate.toISOString();

  return {
    date: localValue.slice(0, 10),
    time: localValue.slice(11, 16),
  };
}

export function combineDateTimeInput(date: string, time: string) {
  if (!date) {
    return null;
  }

  const safeTime = time || "19:00";
  const parsed = new Date(`${date}T${safeTime}:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}

export function extractUuid(data: unknown) {
  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    const first = data[0];

    if (typeof first === "string") {
      return first;
    }

    if (first && typeof first === "object") {
      const record = first as Record<string, unknown>;
      const candidate =
        record.id ??
        record.event_id ??
        record.create_event ??
        record.join_event_by_code;

      return typeof candidate === "string" ? candidate : null;
    }

    return null;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const candidate =
      record.id ??
      record.event_id ??
      record.create_event ??
      record.join_event_by_code;

    return typeof candidate === "string" ? candidate : null;
  }

  return null;
}

export function asEventRows(data: unknown) {
  return Array.isArray(data) ? (data as EventSummary[]) : [];
}

export function asCatalogRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const item = row as CatalogItem;

    return {
      ...item,
      sort_order: item.sort_order == null ? undefined : toNumber(item.sort_order),
    };
  });
}

export function asChoiceRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const choice = row as ChoiceRow;

    return {
      ...choice,
      quantity: toNumber(choice.quantity),
    };
  });
}

export function asMemberRows(data: unknown) {
  return Array.isArray(data) ? (data as MemberDirectoryItem[]) : [];
}

export function asShoppingAdditions(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const addition = row as ShoppingAddition;

    return {
      ...addition,
      quantity: toNumber(addition.quantity),
    };
  });
}

export function asRemainingRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const remaining = row as ShoppingRemainingRow;

    return {
      ...remaining,
      needed: toNumber(remaining.needed),
      brought: toNumber(remaining.brought),
      remaining: toNumber(remaining.remaining),
    };
  });
}

export function asActivityRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => row as ActivityLogRow);
}

export function asAdminEventRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const eventRow = row as AdminEventOverview;

    return {
      ...eventRow,
      member_count: toNumber(eventRow.member_count),
    };
  });
}

export function asAdminOverviewStats(data: unknown): AdminOverviewStats | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return null;
  }

  const stats = row as AdminOverviewStats;

  return {
    total_events: toNumber(stats.total_events),
    active_events: toNumber(stats.active_events),
    archived_events: toNumber(stats.archived_events),
    total_accounts: toNumber(stats.total_accounts),
    banned_accounts: toNumber(stats.banned_accounts),
    average_members_per_event: toNumber(stats.average_members_per_event),
    pending_invitations: toNumber(stats.pending_invitations),
  };
}

export function asAdminUserRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const account = row as AdminUserOverview;

    return {
      ...account,
      is_platform_admin: toBoolean(account.is_platform_admin),
      is_banned: toBoolean(account.is_banned),
      hosted_events: toNumber(account.hosted_events),
      member_events: toNumber(account.member_events),
      pending_invitations: toNumber(account.pending_invitations),
    };
  });
}

export function asAdminUserEventRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => row as AdminUserEvent);
}

export function asInvitationRows(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => row as EventInvitation);
}

export function groupTotals(rows: GroupableRow[]) {
  const grouped = new Map<string, { label: string; unit: string; quantity: number }>();

  for (const row of rows) {
    const key = `${row.label.toLowerCase()}__${row.unit.toLowerCase()}`;
    const current = grouped.get(key);

    if (current) {
      current.quantity += Number(row.quantity) || 0;
      continue;
    }

    grouped.set(key, {
      label: row.label,
      unit: row.unit,
      quantity: Number(row.quantity) || 0,
    });
  }

  return Array.from(grouped.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "fr-FR"),
  );
}

export function sortCatalog(items: CatalogItem[]) {
  return [...items].sort((left, right) => {
    const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const categoryCompare = (left.category ?? "").localeCompare(right.category ?? "", "fr-FR");
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return left.label.localeCompare(right.label, "fr-FR");
  });
}

export function formatInvitationStatus(status: string) {
  if (status === "accepted") {
    return "Acceptee";
  }

  if (status === "revoked") {
    return "Revoquee";
  }

  return "En attente";
}
