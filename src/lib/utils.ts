import type {
  ActivityLogRow,
  AdminEventOverview,
  CatalogItem,
  ChoiceRow,
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

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export function formatEventDate(value: string | null) {
  if (!value) {
    return "Date a definir";
  }

  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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
