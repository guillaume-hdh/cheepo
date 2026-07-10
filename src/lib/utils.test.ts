import { describe, expect, it } from "vitest";
import {
  combineDateTimeInput,
  extractUuid,
  formatQuantity,
  friendlyErrorMessage,
  groupTotals,
  normalizeInviteCode,
  quantityStepForUnit,
  splitDateTimeInput,
} from "./utils";

describe("normalizeInviteCode", () => {
  it("trims spaces and uppercases invitation codes", () => {
    expect(normalizeInviteCode(" ab12c3 ")).toBe("AB12C3");
  });
});

describe("friendlyErrorMessage", () => {
  it("maps known backend errors to user-facing French labels", () => {
    expect(friendlyErrorMessage("EVENT_ARCHIVED")).toBe("Cet evenement est archive.");
    expect(friendlyErrorMessage("ACCESS_DENIED")).toBe("Action non autorisee.");
  });

  it("keeps unknown backend errors visible for debugging", () => {
    expect(friendlyErrorMessage("SOME_NEW_ERROR")).toBe("SOME_NEW_ERROR");
  });
});

describe("formatQuantity", () => {
  it("keeps integers compact and formats decimal quantities with one digit", () => {
    expect(formatQuantity(3)).toBe("3");
    expect(formatQuantity(2.5)).toBe("2.5");
  });
});

describe("quantityStepForUnit", () => {
  it("uses larger steps for gram and centiliter units", () => {
    expect(quantityStepForUnit("g")).toBe(10);
    expect(quantityStepForUnit("cl")).toBe(10);
    expect(quantityStepForUnit("portion")).toBe(1);
  });
});

describe("date time helpers", () => {
  it("round-trips local date and time inputs", () => {
    const combined = combineDateTimeInput("2026-07-10", "19:30");

    expect(combined).not.toBeNull();
    expect(splitDateTimeInput(combined)).toEqual({
      date: "2026-07-10",
      time: "19:30",
    });
  });

  it("returns null when no date is provided", () => {
    expect(combineDateTimeInput("", "19:30")).toBeNull();
  });
});

describe("extractUuid", () => {
  it("extracts UUIDs from direct, array and RPC-shaped payloads", () => {
    expect(extractUuid("abc")).toBe("abc");
    expect(extractUuid(["def"])).toBe("def");
    expect(extractUuid([{ create_event: "ghi" }])).toBe("ghi");
    expect(extractUuid({ join_event_by_code: "jkl" })).toBe("jkl");
  });

  it("returns null for unsupported payloads", () => {
    expect(extractUuid(null)).toBeNull();
    expect(extractUuid([{ missing: "value" }])).toBeNull();
  });
});

describe("groupTotals", () => {
  it("groups rows by label and unit case-insensitively", () => {
    expect(
      groupTotals([
        { label: "Saucisses", unit: "portion", quantity: 2 },
        { label: "saucisses", unit: "PORTION", quantity: 3 },
        { label: "Eau", unit: "bouteille", quantity: 1 },
      ]),
    ).toEqual([
      { label: "Eau", unit: "bouteille", quantity: 1 },
      { label: "Saucisses", unit: "portion", quantity: 5 },
    ]);
  });
});
