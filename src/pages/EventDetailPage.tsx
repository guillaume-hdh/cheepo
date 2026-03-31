import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Link, useParams } from "react-router-dom";
import ActivityTimeline from "../components/ActivityTimeline";
import AppShell from "../components/AppShell";
import DateTimeFields from "../components/DateTimeFields";
import EventItemDetailsPanel, {
  type ChoiceDraft,
  type ShoppingDraft,
} from "../components/EventItemDetailsPanel";
import LoaderButton from "../components/LoaderButton";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";
import { useSession } from "../lib/useSession";
import type {
  ActivityLogRow,
  CatalogItem,
  ChoiceRow,
  EventInvitation,
  EventRole,
  EventSummary,
  EventTab,
  MemberDirectoryItem,
  ShoppingAddition,
  ShoppingRemainingRow,
} from "../lib/types";
import {
  asActivityRows,
  asCatalogRows,
  asChoiceRows,
  asInvitationRows,
  asMemberRows,
  asRemainingRows,
  asShoppingAdditions,
  buildMailtoLink,
  buildShareLink,
  combineDateTimeInput,
  copyText,
  formatEventDate,
  formatInvitationStatus,
  formatQuantity,
  formatTimestamp,
  friendlyErrorMessage,
  groupTotals,
  quantityStepForUnit,
  splitDateTimeInput,
  sortCatalog,
} from "../lib/utils";

const UNIT_CHOICES = ["portion", "piece", "bouteille", "g", "cl"] as const;

type EventBundle = {
  eventRow: EventSummary;
  catalog: CatalogItem[];
  members: MemberDirectoryItem[];
  eatSelections: ChoiceRow[];
  bringItems: ChoiceRow[];
  shoppingAdditions: ShoppingAddition[];
  remainingRows: ShoppingRemainingRow[];
  activityLogs: ActivityLogRow[];
  invitations: EventInvitation[];
};

type EventFormState = {
  title: string;
  description: string;
  location: string;
  event_date: string;
  event_time: string;
};

type InvitationFormState = {
  email: string;
  message: string;
};

function readQuantityInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return friendlyErrorMessage(error.message);
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return friendlyErrorMessage(message);
    }
  }

  return "Une erreur est survenue.";
}

type DetailSelection = {
  tab: "eat" | "bring" | "shop";
  label: string;
  unit: string;
};

function aggregateKey(label: string, unit: string) {
  return `${label.trim().toLowerCase()}__${unit.trim().toLowerCase()}`;
}

function formatRole(role: EventRole) {
  return role === "host" ? "Hote" : "Participant";
}

async function fetchEventBundle(eventId: string): Promise<EventBundle> {
  const [
    eventResult,
    catalogResult,
    membersResult,
    eatResult,
    bringResult,
    shoppingResult,
    remainingResult,
    activityResult,
    invitationsResult,
  ] =
    await Promise.all([
      supabase
        .from("events")
        .select("id,title,description,location,event_date,share_code,host_id,status,archived_at,created_at")
        .eq("id", eventId)
        .single(),
      supabase
        .from("catalog_items")
        .select("id,label,category,unit,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true }),
      supabase.rpc("get_event_members", { p_event_id: eventId }),
      supabase
        .from("eat_selections")
        .select("id,event_id,user_id,label,category,unit,quantity,catalog_item_id,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("bring_items")
        .select("id,event_id,user_id,label,category,unit,quantity,catalog_item_id,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("shopping_additions")
        .select("id,event_id,label,unit,quantity,created_by,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase.rpc("get_shopping_remaining", { p_event_id: eventId }),
      supabase.rpc("get_event_activity_log", { p_event_id: eventId }),
      supabase.rpc("get_event_invitations", { p_event_id: eventId }),
    ]);

  if (eventResult.error) {
    throw eventResult.error;
  }

  if (catalogResult.error) {
    throw catalogResult.error;
  }

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (eatResult.error) {
    throw eatResult.error;
  }

  if (bringResult.error) {
    throw bringResult.error;
  }

  if (shoppingResult.error) {
    throw shoppingResult.error;
  }

  if (remainingResult.error) {
    throw remainingResult.error;
  }

  if (!eventResult.data) {
    throw new Error("Evenement introuvable ou inaccessible.");
  }

  return {
    eventRow: eventResult.data,
    catalog: asCatalogRows(catalogResult.data),
    members: asMemberRows(membersResult.data),
    eatSelections: asChoiceRows(eatResult.data),
    bringItems: asChoiceRows(bringResult.data),
    shoppingAdditions: asShoppingAdditions(shoppingResult.data),
    remainingRows: asRemainingRows(remainingResult.data),
    activityLogs: activityResult.error ? [] : asActivityRows(activityResult.data),
    invitations: invitationsResult.error ? [] : asInvitationRows(invitationsResult.data),
  };
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, isPlatformAdmin } = useSession();
  const [tab, setTab] = useState<EventTab>("eat");
  const [eventRow, setEventRow] = useState<EventSummary | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [eatSelections, setEatSelections] = useState<ChoiceRow[]>([]);
  const [bringItems, setBringItems] = useState<ChoiceRow[]>([]);
  const [shoppingAdditions, setShoppingAdditions] = useState<ShoppingAddition[]>([]);
  const [remainingRows, setRemainingRows] = useState<ShoppingRemainingRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormState>({
    title: "",
    description: "",
    location: "",
    event_date: "",
    event_time: "19:00",
  });
  const [invitationForm, setInvitationForm] = useState<InvitationFormState>({
    email: "",
    message: "",
  });
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [nextHostId, setNextHostId] = useState("");
  const [eatCatalogId, setEatCatalogId] = useState("");
  const [eatCatalogQuantity, setEatCatalogQuantity] = useState(1);
  const [eatCustomLabel, setEatCustomLabel] = useState("");
  const [eatCustomUnit, setEatCustomUnit] = useState<string>("portion");
  const [eatCustomQuantity, setEatCustomQuantity] = useState(1);
  const [bringCatalogId, setBringCatalogId] = useState("");
  const [bringCatalogQuantity, setBringCatalogQuantity] = useState(1);
  const [bringCustomLabel, setBringCustomLabel] = useState("");
  const [bringCustomUnit, setBringCustomUnit] = useState<string>("piece");
  const [bringCustomQuantity, setBringCustomQuantity] = useState(1);
  const [shoppingLabel, setShoppingLabel] = useState("");
  const [shoppingUnit, setShoppingUnit] = useState<string>("piece");
  const [shoppingQuantity, setShoppingQuantity] = useState(1);
  const [eatDrafts, setEatDrafts] = useState<Record<string, ChoiceDraft>>({});
  const [bringDrafts, setBringDrafts] = useState<Record<string, ChoiceDraft>>({});
  const [shoppingDrafts, setShoppingDrafts] = useState<Record<string, ShoppingDraft>>({});
  const [selectedDetail, setSelectedDetail] = useState<DetailSelection | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const currentEventId = eventId;
    let active = true;
    setLoading(true);

    async function bootstrap() {
      try {
        const bundle = await fetchEventBundle(currentEventId);

        if (!active) {
          return;
        }

        setEventRow(bundle.eventRow);
        setCatalog(bundle.catalog);
        setMembers(bundle.members);
        setEatSelections(bundle.eatSelections);
        setBringItems(bundle.bringItems);
        setShoppingAdditions(bundle.shoppingAdditions);
        setRemainingRows(bundle.remainingRows);
        setActivityLogs(bundle.activityLogs);
        setInvitations(bundle.invitations);
      } catch (error) {
        if (active) {
          toast(readErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventRow) {
      return;
    }

    const nextDateTime = splitDateTimeInput(eventRow.event_date);

    setEventForm({
      title: eventRow.title,
      description: eventRow.description ?? "",
      location: eventRow.location ?? "",
      event_date: nextDateTime.date,
      event_time: nextDateTime.time,
    });
    setDuplicateTitle(`${eventRow.title} (copie)`);
  }, [eventRow]);

  useEffect(() => {
    const candidate = members.find((member) => member.role !== "host");
    setNextHostId(candidate?.user_id ?? "");
  }, [members]);

  useEffect(() => {
    const nextDrafts: Record<string, ChoiceDraft> = {};

    for (const row of eatSelections) {
      nextDrafts[row.id] = {
        label: row.label,
        unit: row.unit,
        quantity: row.quantity,
      };
    }

    setEatDrafts(nextDrafts);
  }, [eatSelections]);

  useEffect(() => {
    const nextDrafts: Record<string, ChoiceDraft> = {};

    for (const row of bringItems) {
      nextDrafts[row.id] = {
        label: row.label,
        unit: row.unit,
        quantity: row.quantity,
      };
    }

    setBringDrafts(nextDrafts);
  }, [bringItems]);

  useEffect(() => {
    const nextDrafts: Record<string, ShoppingDraft> = {};

    for (const row of shoppingAdditions) {
      nextDrafts[row.id] = {
        label: row.label,
        unit: row.unit,
        quantity: row.quantity,
      };
    }

    setShoppingDrafts(nextDrafts);
  }, [shoppingAdditions]);

  const catalogOptions = useMemo(() => sortCatalog(catalog), [catalog]);
  const myEat = useMemo(
    () => eatSelections.filter((row) => row.user_id === user?.id),
    [eatSelections, user?.id],
  );
  const myBring = useMemo(
    () => bringItems.filter((row) => row.user_id === user?.id),
    [bringItems, user?.id],
  );
  const myShoppingAdditions = useMemo(
    () => shoppingAdditions.filter((row) => row.created_by === user?.id),
    [shoppingAdditions, user?.id],
  );
  const eatTotals = useMemo(() => groupTotals(eatSelections), [eatSelections]);
  const bringTotals = useMemo(() => groupTotals(bringItems), [bringItems]);
  const memberNames = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.user_id,
          member.display_name || member.email || "Participant",
        ]),
      ),
    [members],
  );
  const eatCatalogUnit = useMemo(
    () => catalogOptions.find((item) => item.id === eatCatalogId)?.unit ?? "portion",
    [catalogOptions, eatCatalogId],
  );
  const bringCatalogUnit = useMemo(
    () => catalogOptions.find((item) => item.id === bringCatalogId)?.unit ?? "piece",
    [catalogOptions, bringCatalogId],
  );
  const isHost = eventRow?.host_id === user?.id;
  const isArchived = eventRow?.status === "archived";
  const canManageEvent = Boolean(user && (isPlatformAdmin || isHost));
  const transferableMembers = useMemo(
    () => members.filter((member) => member.role !== "host"),
    [members],
  );
  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );
  const selectedEatRows = useMemo(
    () =>
      selectedDetail?.tab === "eat"
        ? eatSelections.filter(
            (row) => aggregateKey(row.label, row.unit) === aggregateKey(selectedDetail.label, selectedDetail.unit),
          )
        : [],
    [eatSelections, selectedDetail],
  );
  const selectedBringRows = useMemo(
    () =>
      selectedDetail?.tab === "bring"
        ? bringItems.filter(
            (row) => aggregateKey(row.label, row.unit) === aggregateKey(selectedDetail.label, selectedDetail.unit),
          )
        : [],
    [bringItems, selectedDetail],
  );
  const selectedShoppingRows = useMemo(
    () =>
      selectedDetail?.tab === "shop"
        ? shoppingAdditions.filter(
            (row) => aggregateKey(row.label, row.unit) === aggregateKey(selectedDetail.label, selectedDetail.unit),
          )
        : [],
    [selectedDetail, shoppingAdditions],
  );

  function renderCatalogOptions() {
    const groups = new Map<string, CatalogItem[]>();

    for (const item of catalogOptions) {
      const groupKey = item.category ?? "Autres";
      const existing = groups.get(groupKey);

      if (existing) {
        existing.push(item);
      } else {
        groups.set(groupKey, [item]);
      }
    }

    return Array.from(groups.entries()).map(([category, items]) => (
      <optgroup key={category} label={category}>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} ({item.unit})
          </option>
        ))}
      </optgroup>
    ));
  }

  async function reloadPage() {
    if (!eventId) {
      return;
    }

    const bundle = await fetchEventBundle(eventId);
    setEventRow(bundle.eventRow);
    setCatalog(bundle.catalog);
    setMembers(bundle.members);
    setEatSelections(bundle.eatSelections);
    setBringItems(bundle.bringItems);
    setShoppingAdditions(bundle.shoppingAdditions);
    setRemainingRows(bundle.remainingRows);
    setActivityLogs(bundle.activityLogs);
    setInvitations(bundle.invitations);
  }

  async function insertChoice(
    table: "eat_selections" | "bring_items",
    payload: {
      label: string;
      category: string | null;
      unit: string;
      quantity: number;
      catalog_item_id: string | null;
    },
  ) {
    if (!eventId || !user) {
      toast("Session introuvable");
      return false;
    }

    setWorking(true);

    const { error } = await supabase.from(table).insert({
      event_id: eventId,
      user_id: user.id,
      ...payload,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return false;
    }

    await reloadPage();
    return true;
  }

  async function handleEatCatalogSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    const item = catalogOptions.find((entry) => entry.id === eatCatalogId);
    if (!item) {
      toast("Choisis un article du catalogue");
      return;
    }

    const created = await insertChoice("eat_selections", {
      label: item.label,
      category: item.category ?? null,
      unit: item.unit,
      quantity: eatCatalogQuantity,
      catalog_item_id: item.id,
    });

    if (created) {
      setEatCatalogQuantity(quantityStepForUnit(item.unit));
    }
  }

  async function handleEatCustomSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (!eatCustomLabel.trim()) {
      toast("Ajoute un libelle");
      return;
    }

    const created = await insertChoice("eat_selections", {
      label: eatCustomLabel.trim(),
      category: null,
      unit: eatCustomUnit,
      quantity: eatCustomQuantity,
      catalog_item_id: null,
    });

    if (created) {
      setEatCustomLabel("");
      setEatCustomUnit("portion");
      setEatCustomQuantity(1);
    }
  }

  async function handleBringCatalogSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    const item = catalogOptions.find((entry) => entry.id === bringCatalogId);
    if (!item) {
      toast("Choisis un article du catalogue");
      return;
    }

    const created = await insertChoice("bring_items", {
      label: item.label,
      category: item.category ?? null,
      unit: item.unit,
      quantity: bringCatalogQuantity,
      catalog_item_id: item.id,
    });

    if (created) {
      setBringCatalogQuantity(quantityStepForUnit(item.unit));
    }
  }

  async function handleBringCustomSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (!bringCustomLabel.trim()) {
      toast("Ajoute un libelle");
      return;
    }

    const created = await insertChoice("bring_items", {
      label: bringCustomLabel.trim(),
      category: null,
      unit: bringCustomUnit,
      quantity: bringCustomQuantity,
      catalog_item_id: null,
    });

    if (created) {
      setBringCustomLabel("");
      setBringCustomUnit("piece");
      setBringCustomQuantity(1);
    }
  }

  async function handleDeleteChoice(table: "eat_selections" | "bring_items", choiceId: string) {
    setWorking(true);
    const { error } = await supabase.from(table).delete().eq("id", choiceId);
    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    await reloadPage();
  }

  async function handleAddShopping(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (!eventId || !user) {
      toast("Session introuvable");
      return;
    }

    if (!shoppingLabel.trim()) {
      toast("Ajoute un article");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("shopping_additions").insert({
      event_id: eventId,
      label: shoppingLabel.trim(),
      unit: shoppingUnit,
      quantity: shoppingQuantity,
      created_by: user.id,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    setShoppingLabel("");
    setShoppingUnit("piece");
    setShoppingQuantity(1);
    await reloadPage();
  }

  async function handleDeleteShopping(additionId: string) {
    setWorking(true);
    const { error } = await supabase.from("shopping_additions").delete().eq("id", additionId);
    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    await reloadPage();
  }

  function handleEventFormChange(field: keyof EventFormState, value: string) {
    setEventForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleEventSave(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (!eventId || !canManageEvent) {
      return;
    }

    if (!eventForm.title.trim()) {
      toast("Ajoute un titre");
      return;
    }

    setWorking(true);

    const { error } = await supabase
      .from("events")
      .update({
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || null,
        location: eventForm.location.trim() || null,
        event_date: combineDateTimeInput(eventForm.event_date, eventForm.event_time),
      })
      .eq("id", eventId);

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast("Evenement mis a jour");
    await reloadPage();
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!eventId || !canManageEvent) {
      return;
    }

    setWorking(true);

    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", memberUserId);

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast("Participant retire");
    await reloadPage();
  }

  function handleInvitationFormChange(field: keyof InvitationFormState, value: string) {
    setInvitationForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCreateInvitation(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (!eventId || !eventRow || !canManageEvent) {
      return;
    }

    if (!invitationForm.email.trim()) {
      toast("Ajoute un email");
      return;
    }

    setWorking(true);

    const { error } = await supabase.rpc("create_event_invitation", {
      p_event_id: eventId,
      p_email: invitationForm.email.trim(),
      p_message: invitationForm.message.trim() || null,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    const inviteLink = buildShareLink(eventRow.share_code);
    const subject = `Invitation pour ${eventRow.title}`;
    const body = [
      `Bonjour,`,
      ``,
      `Tu es invite a l evenement "${eventRow.title}".`,
      invitationForm.message.trim() || `Tu peux rejoindre l evenement avec ce lien : ${inviteLink}`,
      ``,
      `Lien d invitation : ${inviteLink}`,
    ].join("\n");

    window.location.href = buildMailtoLink(invitationForm.email.trim(), subject, body);
    setInvitationForm({ email: "", message: "" });
    toast("Invitation preparee");
    await reloadPage();
  }

  async function handleRevokeInvitation(invitationId: string) {
    setWorking(true);

    const { error } = await supabase.rpc("revoke_event_invitation", {
      p_invitation_id: invitationId,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast("Invitation revoquee");
    await reloadPage();
  }

  async function handleArchiveToggle() {
    if (!eventId || !eventRow || !canManageEvent) {
      return;
    }

    setWorking(true);

    const { error } = await supabase.rpc("archive_event", {
      p_event_id: eventId,
      p_archived: !isArchived,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast(isArchived ? "Evenement reactive" : "Evenement archive");
    await reloadPage();
  }

  async function handleDuplicateEvent() {
    if (!eventId || !canManageEvent) {
      return;
    }

    setWorking(true);

    const { data, error } = await supabase.rpc("duplicate_event", {
      p_event_id: eventId,
      p_title: duplicateTitle.trim() || null,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    const newEventId = typeof data === "string" ? data : null;

    toast("Evenement duplique");
    if (newEventId) {
      window.location.href = `/events/${newEventId}`;
      return;
    }

    await reloadPage();
  }

  async function handleTransferHost() {
    if (!eventId || !canManageEvent || !nextHostId) {
      return;
    }

    setWorking(true);

    const { error } = await supabase.rpc("transfer_event_host", {
      p_event_id: eventId,
      p_new_host_user_id: nextHostId,
    });

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast("Role d hote transfere");
    await reloadPage();
  }

  function handleChoiceDraftChange(
    setDrafts: Dispatch<SetStateAction<Record<string, ChoiceDraft>>>,
    rowId: string,
    field: keyof ChoiceDraft,
    value: string | number,
  ) {
    setDrafts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] ?? { label: "", unit: "", quantity: 1 }),
        [field]: field === "quantity" ? Number(value) || 1 : value,
      },
    }));
  }

  function handleShoppingDraftChange(rowId: string, field: keyof ShoppingDraft, value: string | number) {
    setShoppingDrafts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] ?? { label: "", unit: "", quantity: 1 }),
        [field]: field === "quantity" ? Number(value) || 1 : value,
      },
    }));
  }

  async function handleChoiceUpdate(
    table: "eat_selections" | "bring_items",
    rowId: string,
    draft: ChoiceDraft | undefined,
  ) {
    if (!draft) {
      return;
    }

    setWorking(true);

    const { error } = await supabase
      .from(table)
      .update({
        label: draft.label.trim(),
        unit: draft.unit.trim(),
        quantity: draft.quantity,
      })
      .eq("id", rowId);

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast("Modification enregistree");
    await reloadPage();
  }

  async function handleShoppingUpdate(rowId: string, draft: ShoppingDraft | undefined) {
    if (!draft) {
      return;
    }

    setWorking(true);

    const { error } = await supabase
      .from("shopping_additions")
      .update({
        label: draft.label.trim(),
        unit: draft.unit.trim(),
        quantity: draft.quantity,
      })
      .eq("id", rowId);

    setWorking(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast("Course mise a jour");
    await reloadPage();
  }

  function handleTakeRemaining(row: ShoppingRemainingRow) {
    setTab("bring");
    setBringCatalogId("");
    setBringCustomLabel(row.label);
    setBringCustomUnit(row.unit);
    setBringCustomQuantity(Math.max(row.remaining, quantityStepForUnit(row.unit)));
    toast("La contribution a ete pre-remplie");
  }

  async function handleCopyInvite() {
    if (!eventRow) {
      return;
    }

    const copied = await copyText(buildShareLink(eventRow.share_code));
    if (!copied) {
      toast("Impossible de copier le lien");
      return;
    }

    toast("Lien d invitation copie");
  }

  function handleToggleDetail(tabName: DetailSelection["tab"], label: string, unit: string) {
    setSelectedDetail((current) => {
      if (
        current &&
        current.tab === tabName &&
        aggregateKey(current.label, current.unit) === aggregateKey(label, unit)
      ) {
        return null;
      }

      return {
        tab: tabName,
        label,
        unit,
      };
    });
  }

  if (!eventId) {
    return (
      <div className="centered-state">
        <section className="panel">Evenement introuvable.</section>
      </div>
    );
  }

  return (
    <AppShell
      title={eventRow?.title ?? "Evenement"}
      subtitle={
        eventRow?.description ||
        "Coordonne les participants, les repas, les contributions et la liste de courses."
      }
      actions={
        <div className="hero-actions">
          {eventRow ? <span className="pill pill-soft">Code {eventRow.share_code}</span> : null}
          {isPlatformAdmin ? <span className="pill">Super-Admin</span> : null}
          {isHost ? <span className="pill">Hote</span> : null}
          <button type="button" className="btn btn-secondary" onClick={() => void handleCopyInvite()}>
            Copier l invitation
          </button>
          <Link to="/events" className="btn btn-ghost">
            Retour
          </Link>
        </div>
      }
    >
      {loading ? (
        <section className="panel">Chargement de l evenement...</section>
      ) : !eventRow ? (
        <section className="panel">Impossible de charger cet evenement.</section>
      ) : (
        <>
          <div className="overview-grid">
            <section className="panel stack-lg">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Infos</p>
                  <h2>Vue d ensemble</h2>
                </div>
              </div>

              <dl className="meta-grid">
                <div>
                  <dt>Date</dt>
                  <dd>{formatEventDate(eventRow.event_date)}</dd>
                </div>
                <div>
                  <dt>Lieu</dt>
                  <dd>{eventRow.location || "A confirmer"}</dd>
                </div>
                <div>
                  <dt>Cree le</dt>
                  <dd>{formatTimestamp(eventRow.created_at)}</dd>
                </div>
                <div>
                  <dt>Participants</dt>
                  <dd>{members.length}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>{isArchived ? "Archive" : "Actif"}</dd>
                </div>
              </dl>

              <div className="callout">
                Partage le lien d invitation avec le code <strong>{eventRow.share_code}</strong> pour
                faire rejoindre rapidement le barbecue.
              </div>
            </section>

            <section className="panel stack-lg">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Equipe</p>
                  <h2>Participants</h2>
                </div>
              </div>

              <div className="member-list">
                {members.length === 0 ? (
                  <div className="empty-state">Aucun participant charge pour l instant.</div>
                ) : (
                  members.map((member) => (
                    <article key={member.user_id} className="member-card">
                      <strong>{member.display_name}</strong>
                      <span>
                        {formatRole(member.role)}{member.email ? ` - ${member.email}` : ""}
                      </span>
                      {canManageEvent && member.role !== "host" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={working}
                          onClick={() => void handleRemoveMember(member.user_id)}
                        >
                          Retirer
                        </button>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="tab-row">
            <button
              type="button"
              className={tab === "eat" ? "tab tab-active" : "tab"}
              onClick={() => setTab("eat")}
            >
              Qui mange quoi
            </button>
            <button
              type="button"
              className={tab === "bring" ? "tab tab-active" : "tab"}
              onClick={() => setTab("bring")}
            >
              Qui apporte quoi
            </button>
            <button
              type="button"
              className={tab === "shop" ? "tab tab-active" : "tab"}
              onClick={() => setTab("shop")}
            >
              Courses
            </button>
            <button
              type="button"
              className={tab === "activity" ? "tab tab-active" : "tab"}
              onClick={() => setTab("activity")}
            >
              Journal
            </button>
            {canManageEvent ? (
              <button
                type="button"
                className={tab === "manage" ? "tab tab-active" : "tab"}
                onClick={() => setTab("manage")}
              >
                Gestion
              </button>
            ) : null}
          </div>

          {tab === "eat" ? (
            <>
              <div className="dashboard-grid">
                <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Mes envies</p>
                    <h2>Ce que je veux manger</h2>
                  </div>
                </div>

                <form className="stack-md" onSubmit={handleEatCatalogSubmit}>
                  <label className="field-block">
                    <span>Choix catalogue</span>
                    <select
                      className="field-input"
                      value={eatCatalogId}
                      onChange={(formEvent) => setEatCatalogId(formEvent.target.value)}
                    >
                      <option value="">Choisir un article</option>
                      {renderCatalogOptions()}
                    </select>
                  </label>

                  <div className="grid-two">
                    <label className="field-block">
                      <span>Quantite</span>
                      <input
                        className="field-input"
                        type="number"
                        min={quantityStepForUnit(eatCatalogUnit)}
                        step={quantityStepForUnit(eatCatalogUnit)}
                        value={eatCatalogQuantity}
                        onChange={(formEvent) =>
                          setEatCatalogQuantity(readQuantityInput(formEvent.target.value))
                        }
                      />
                    </label>
                    <div className="field-block">
                      <span>Unite</span>
                      <input className="field-input" value={eatCatalogUnit} readOnly />
                    </div>
                  </div>

                  <LoaderButton type="submit" loading={working} disabled={!eatCatalogId}>
                    Ajouter depuis le catalogue
                  </LoaderButton>
                </form>

                <div className="divider" />

                <form className="stack-md" onSubmit={handleEatCustomSubmit}>
                  <label className="field-block">
                    <span>Ajout libre</span>
                    <input
                      className="field-input"
                      value={eatCustomLabel}
                      onChange={(formEvent) => setEatCustomLabel(formEvent.target.value)}
                      placeholder="Ex : salade maison"
                    />
                  </label>

                  <div className="grid-two">
                    <label className="field-block">
                      <span>Unite</span>
                      <select
                        className="field-input"
                        value={eatCustomUnit}
                        onChange={(formEvent) => setEatCustomUnit(formEvent.target.value)}
                      >
                        {UNIT_CHOICES.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Quantite</span>
                      <input
                        className="field-input"
                        type="number"
                        min={quantityStepForUnit(eatCustomUnit)}
                        step={quantityStepForUnit(eatCustomUnit)}
                        value={eatCustomQuantity}
                        onChange={(formEvent) =>
                          setEatCustomQuantity(readQuantityInput(formEvent.target.value))
                        }
                      />
                    </label>
                  </div>

                  <LoaderButton type="submit" tone="secondary" loading={working}>
                    Ajouter librement
                  </LoaderButton>
                </form>
                </section>

                <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Recap</p>
                    <h2>Ce qui est prevu</h2>
                  </div>
                </div>

                <div className="stack-md">
                  <h3>Mes choix</h3>
                  {myEat.length === 0 ? (
                    <div className="empty-state">Tu n as encore rien ajoute.</div>
                  ) : (
                    <div className="row-list">
                      {myEat.map((row) => (
                        <article key={row.id} className="row-card">
                          <div>
                            <strong>{row.label}</strong>
                            <span>
                              {formatQuantity(row.quantity)} {row.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={working}
                            onClick={() => void handleDeleteChoice("eat_selections", row.id)}
                          >
                            Supprimer
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="stack-md">
                  <h3>Total participants</h3>
                  {eatTotals.length === 0 ? (
                    <div className="empty-state">Aucune demande pour l instant.</div>
                  ) : (
                    <div className="row-list">
                      {eatTotals.map((row) => (
                        <article key={`${row.label}-${row.unit}`} className="row-card">
                          <div>
                            <strong>{row.label}</strong>
                            <span>
                              {formatQuantity(row.quantity)} {row.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleToggleDetail("eat", row.label, row.unit)}
                          >
                            {selectedDetail?.tab === "eat" &&
                            aggregateKey(selectedDetail.label, selectedDetail.unit) === aggregateKey(row.label, row.unit)
                              ? "Masquer"
                              : "Details"}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDetail?.tab === "eat" ? (
                  <EventItemDetailsPanel
                    mode="choice"
                    title="Lignes repas"
                    itemLabel={selectedDetail.label}
                    itemUnit={selectedDetail.unit}
                    rows={selectedEatRows}
                    ownerLabels={memberNames}
                    currentUserId={user?.id}
                    canManageAll={canManageEvent}
                    drafts={eatDrafts}
                    loading={working}
                    onDraftChange={(rowId, field, value) =>
                      handleChoiceDraftChange(setEatDrafts, rowId, field, value)
                    }
                    onSave={async (rowId) =>
                      handleChoiceUpdate("eat_selections", rowId, eatDrafts[rowId])
                    }
                    onDelete={async (rowId) => handleDeleteChoice("eat_selections", rowId)}
                  />
                ) : null}
                </section>
              </div>
            </>
          ) : null}

          {tab === "bring" ? (
            <>
              <div className="dashboard-grid">
                <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Contributions</p>
                    <h2>Ce que j apporte</h2>
                  </div>
                </div>

                <form className="stack-md" onSubmit={handleBringCatalogSubmit}>
                  <label className="field-block">
                    <span>Depuis le catalogue</span>
                    <select
                      className="field-input"
                      value={bringCatalogId}
                      onChange={(formEvent) => setBringCatalogId(formEvent.target.value)}
                    >
                      <option value="">Choisir un article</option>
                      {renderCatalogOptions()}
                    </select>
                  </label>

                  <div className="grid-two">
                    <label className="field-block">
                      <span>Quantite</span>
                      <input
                        className="field-input"
                        type="number"
                        min={quantityStepForUnit(bringCatalogUnit)}
                        step={quantityStepForUnit(bringCatalogUnit)}
                        value={bringCatalogQuantity}
                        onChange={(formEvent) =>
                          setBringCatalogQuantity(readQuantityInput(formEvent.target.value))
                        }
                      />
                    </label>
                    <div className="field-block">
                      <span>Unite</span>
                      <input className="field-input" value={bringCatalogUnit} readOnly />
                    </div>
                  </div>

                  <LoaderButton type="submit" loading={working} disabled={!bringCatalogId}>
                    Je ramene cet article
                  </LoaderButton>
                </form>

                <div className="divider" />

                <form className="stack-md" onSubmit={handleBringCustomSubmit}>
                  <label className="field-block">
                    <span>Ajout libre</span>
                    <input
                      className="field-input"
                      value={bringCustomLabel}
                      onChange={(formEvent) => setBringCustomLabel(formEvent.target.value)}
                      placeholder="Ex : chips, salade, glacons"
                    />
                  </label>

                  <div className="grid-two">
                    <label className="field-block">
                      <span>Unite</span>
                      <select
                        className="field-input"
                        value={bringCustomUnit}
                        onChange={(formEvent) => setBringCustomUnit(formEvent.target.value)}
                      >
                        {UNIT_CHOICES.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Quantite</span>
                      <input
                        className="field-input"
                        type="number"
                        min={quantityStepForUnit(bringCustomUnit)}
                        step={quantityStepForUnit(bringCustomUnit)}
                        value={bringCustomQuantity}
                        onChange={(formEvent) =>
                          setBringCustomQuantity(readQuantityInput(formEvent.target.value))
                        }
                      />
                    </label>
                  </div>

                  <LoaderButton type="submit" tone="secondary" loading={working}>
                    Ajouter ma contribution
                  </LoaderButton>
                </form>
                </section>

                <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Recap</p>
                    <h2>Contributions promises</h2>
                  </div>
                </div>

                <div className="stack-md">
                  <h3>Ce que j apporte</h3>
                  {myBring.length === 0 ? (
                    <div className="empty-state">Tu n as encore rien promis.</div>
                  ) : (
                    <div className="row-list">
                      {myBring.map((row) => (
                        <article key={row.id} className="row-card">
                          <div>
                            <strong>{row.label}</strong>
                            <span>
                              {formatQuantity(row.quantity)} {row.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={working}
                            onClick={() => void handleDeleteChoice("bring_items", row.id)}
                          >
                            Supprimer
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="stack-md">
                  <h3>Total apporte</h3>
                  {bringTotals.length === 0 ? (
                    <div className="empty-state">Aucune contribution pour l instant.</div>
                  ) : (
                    <div className="row-list">
                      {bringTotals.map((row) => (
                        <article key={`${row.label}-${row.unit}`} className="row-card">
                          <div>
                            <strong>{row.label}</strong>
                            <span>
                              {formatQuantity(row.quantity)} {row.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleToggleDetail("bring", row.label, row.unit)}
                          >
                            {selectedDetail?.tab === "bring" &&
                            aggregateKey(selectedDetail.label, selectedDetail.unit) === aggregateKey(row.label, row.unit)
                              ? "Masquer"
                              : "Details"}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDetail?.tab === "bring" ? (
                  <EventItemDetailsPanel
                    mode="choice"
                    title="Lignes apports"
                    itemLabel={selectedDetail.label}
                    itemUnit={selectedDetail.unit}
                    rows={selectedBringRows}
                    ownerLabels={memberNames}
                    currentUserId={user?.id}
                    canManageAll={canManageEvent}
                    drafts={bringDrafts}
                    loading={working}
                    onDraftChange={(rowId, field, value) =>
                      handleChoiceDraftChange(setBringDrafts, rowId, field, value)
                    }
                    onSave={async (rowId) =>
                      handleChoiceUpdate("bring_items", rowId, bringDrafts[rowId])
                    }
                    onDelete={async (rowId) => handleDeleteChoice("bring_items", rowId)}
                  />
                ) : null}
                </section>
              </div>
            </>
          ) : null}

          {tab === "shop" ? (
            <>
              <div className="dashboard-grid">
                <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">A acheter</p>
                    <h2>Ce qu il manque encore</h2>
                  </div>
                </div>

                {remainingRows.length === 0 ? (
                  <div className="empty-state">Rien a acheter pour le moment.</div>
                ) : (
                  <div className="row-list">
                    {remainingRows.map((row) => (
                      <article key={`${row.label}-${row.unit}`} className="row-card">
                        <div>
                          <strong>{row.label}</strong>
                          <span>
                            Reste {formatQuantity(row.remaining)} {row.unit} - besoin{" "}
                            {formatQuantity(row.needed)} - promis {formatQuantity(row.brought)}
                          </span>
                        </div>
                        <div className="event-card-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleToggleDetail("shop", row.label, row.unit)}
                          >
                            {selectedDetail?.tab === "shop" &&
                            aggregateKey(selectedDetail.label, selectedDetail.unit) === aggregateKey(row.label, row.unit)
                              ? "Masquer"
                              : "Details"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleTakeRemaining(row)}
                          >
                            Je m en charge
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                </section>

                <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Ajout manuel</p>
                    <h2>Liste de courses libre</h2>
                  </div>
                </div>

                <form className="stack-md" onSubmit={handleAddShopping}>
                  <label className="field-block">
                    <span>Article</span>
                    <input
                      className="field-input"
                      value={shoppingLabel}
                      onChange={(formEvent) => setShoppingLabel(formEvent.target.value)}
                      placeholder="Ex : glacons, sauce, citron"
                    />
                  </label>

                  <div className="grid-two">
                    <label className="field-block">
                      <span>Unite</span>
                      <select
                        className="field-input"
                        value={shoppingUnit}
                        onChange={(formEvent) => setShoppingUnit(formEvent.target.value)}
                      >
                        {UNIT_CHOICES.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Quantite</span>
                      <input
                        className="field-input"
                        type="number"
                        min={quantityStepForUnit(shoppingUnit)}
                        step={quantityStepForUnit(shoppingUnit)}
                        value={shoppingQuantity}
                        onChange={(formEvent) =>
                          setShoppingQuantity(readQuantityInput(formEvent.target.value))
                        }
                      />
                    </label>
                  </div>

                  <LoaderButton type="submit" loading={working}>
                    Ajouter a la liste
                  </LoaderButton>
                </form>

                <div className="stack-md">
                  <h3>Mes ajouts manuels</h3>
                  {myShoppingAdditions.length === 0 ? (
                    <div className="empty-state">Aucun ajout manuel pour l instant.</div>
                  ) : (
                    <div className="row-list">
                      {myShoppingAdditions.map((row) => (
                        <article key={row.id} className="row-card">
                          <div>
                            <strong>{row.label}</strong>
                            <span>
                              {formatQuantity(row.quantity)} {row.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={working}
                            onClick={() => void handleDeleteShopping(row.id)}
                          >
                            Supprimer
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDetail?.tab === "shop" ? (
                  <EventItemDetailsPanel
                    mode="shopping"
                    title="Lignes courses"
                    itemLabel={selectedDetail.label}
                    itemUnit={selectedDetail.unit}
                    rows={selectedShoppingRows}
                    ownerLabels={memberNames}
                    currentUserId={user?.id}
                    canManageAll={canManageEvent}
                    drafts={shoppingDrafts}
                    loading={working}
                    onDraftChange={handleShoppingDraftChange}
                    onSave={async (rowId) => handleShoppingUpdate(rowId, shoppingDrafts[rowId])}
                    onDelete={async (rowId) => handleDeleteShopping(rowId)}
                  />
                ) : null}
                </section>
              </div>
            </>
          ) : null}

          {tab === "manage" && canManageEvent ? (
            <div className="dashboard-grid">
              <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Pilotage</p>
                    <h2>Modifier l evenement</h2>
                  </div>
                </div>

                <form className="stack-md" onSubmit={handleEventSave}>
                  <label className="field-block">
                    <span>Titre</span>
                    <input
                      className="field-input"
                      value={eventForm.title}
                      onChange={(event) => handleEventFormChange("title", event.target.value)}
                    />
                  </label>

                  <DateTimeFields
                    dateValue={eventForm.event_date}
                    timeValue={eventForm.event_time}
                    onDateChange={(value) => handleEventFormChange("event_date", value)}
                    onTimeChange={(value) => handleEventFormChange("event_time", value)}
                  />

                  <label className="field-block">
                    <span>Lieu</span>
                    <input
                      className="field-input"
                      value={eventForm.location}
                      onChange={(event) => handleEventFormChange("location", event.target.value)}
                    />
                  </label>

                  <label className="field-block">
                    <span>Description</span>
                    <textarea
                      className="field-input field-textarea"
                      value={eventForm.description}
                      onChange={(event) => handleEventFormChange("description", event.target.value)}
                    />
                  </label>

                  <LoaderButton type="submit" loading={working}>
                    Enregistrer les infos
                  </LoaderButton>
                </form>
              </section>

              <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Invitations</p>
                    <h2>Inviter par email</h2>
                  </div>
                  <span className="pill pill-soft">
                    {pendingInvitations.length} en attente
                  </span>
                </div>

                <form className="stack-md" onSubmit={handleCreateInvitation}>
                  <label className="field-block">
                    <span>Email</span>
                    <input
                      className="field-input"
                      type="email"
                      value={invitationForm.email}
                      onChange={(event) => handleInvitationFormChange("email", event.target.value)}
                      placeholder="invite@email.fr"
                    />
                  </label>

                  <label className="field-block">
                    <span>Message optionnel</span>
                    <textarea
                      className="field-input field-textarea"
                      value={invitationForm.message}
                      onChange={(event) => handleInvitationFormChange("message", event.target.value)}
                      placeholder="Ex : on commence a 19h, prends ce que tu veux boire."
                    />
                  </label>

                  <LoaderButton type="submit" loading={working}>
                    Preparer l invitation
                  </LoaderButton>
                </form>

                <div className="stack-md">
                  <h3>Suivi des invitations</h3>
                  {invitations.length === 0 ? (
                    <div className="empty-state">Aucune invitation envoyee pour l instant.</div>
                  ) : (
                    <div className="row-list">
                      {invitations.map((invitation) => (
                        <article key={invitation.id} className="row-card">
                          <div>
                            <strong>{invitation.email}</strong>
                            <span>
                              {formatInvitationStatus(invitation.status)} - envoyee le{" "}
                              {formatTimestamp(invitation.invited_at)}
                            </span>
                            {invitation.accepted_user_name ? (
                              <span>
                                Acceptee par {invitation.accepted_user_name}
                                {invitation.accepted_at ? ` le ${formatTimestamp(invitation.accepted_at)}` : ""}
                              </span>
                            ) : null}
                          </div>

                          <div className="event-card-actions">
                            {invitation.status !== "revoked" ? (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={working}
                                onClick={() => void handleRevokeInvitation(invitation.id)}
                              >
                                Revoquer
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() =>
                                void copyText(buildShareLink(eventRow.share_code)).then((copied) => {
                                  toast(copied ? "Lien copie" : "Impossible de copier le lien");
                                })
                              }
                            >
                              Copier le lien
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Hote</p>
                    <h2>Transfert du role</h2>
                  </div>
                </div>

                {transferableMembers.length === 0 ? (
                  <div className="empty-state">Ajoute d abord au moins un autre membre a l evenement.</div>
                ) : (
                  <div className="stack-md">
                    <label className="field-block">
                      <span>Nouveau hote</span>
                      <select
                        className="field-input"
                        value={nextHostId}
                        onChange={(event) => setNextHostId(event.target.value)}
                      >
                        {transferableMembers.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.display_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <LoaderButton type="button" loading={working} onClick={() => void handleTransferHost()}>
                      Transferer le role d hote
                    </LoaderButton>
                  </div>
                )}
              </section>

              <section className="panel stack-lg">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Actions rapides</p>
                    <h2>Archiver ou dupliquer</h2>
                  </div>
                </div>

                <div className="stack-md">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={working}
                    onClick={() => void handleArchiveToggle()}
                  >
                    {isArchived ? "Reactiver l evenement" : "Archiver l evenement"}
                  </button>

                  <label className="field-block">
                    <span>Titre de la copie</span>
                    <input
                      className="field-input"
                      value={duplicateTitle}
                      onChange={(event) => setDuplicateTitle(event.target.value)}
                    />
                  </label>

                  <LoaderButton type="button" loading={working} onClick={() => void handleDuplicateEvent()}>
                    Dupliquer l evenement
                  </LoaderButton>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "activity" ? (
            <section className="panel stack-lg">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Audit</p>
                  <h2>Journal des modifications</h2>
                </div>
              </div>

              <ActivityTimeline logs={activityLogs} />
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
