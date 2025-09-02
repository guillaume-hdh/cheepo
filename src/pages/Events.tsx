import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import LoaderButton from "../components/LoaderButton";
import { toast } from "../lib/toast";

type EventRow = {
  id: string;
  title: string;
  share_code: string;
  event_date: string | null;
  location: string | null;
};

function makeShareCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function Events() {
  const nav = useNavigate();

  // form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>("");
  const [dateInputType, setDateInputType] = useState<"text" | "date">("text");
  const onDateFocus = () => setDateInputType("date");
  const onDateBlur = () => setDateInputType(date ? "date" : "text");

  const [location, setLocation] = useState("");
  const canCreate = useMemo(() => title.trim().length > 1 && !!date, [title, date]);

  // states
  const [creating, setCreating] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [items, setItems] = useState<EventRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        nav("/"); // pas connecté → accueil
        return;
      }
      await refreshEvents(auth.user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshEvents(userId: string) {
    setLoadingList(true);
    // 1) récupère les IDs via event_members
    const { data: mems, error: mErr } = await supabase
      .from("event_members")
      .select("event_id")
      .eq("user_id", userId);

    if (mErr) {
      console.error(mErr);
      toast("Erreur chargement des événements");
      setLoadingList(false);
      return;
    }
    const ids = (mems || []).map((m: any) => m.event_id);
    if (!ids.length) {
      setItems([]);
      setLoadingList(false);
      return;
    }

    // 2) charge les events
    const { data: evs, error: eErr } = await supabase
      .from("events")
      .select("id,title,share_code,event_date,location")
      .in("id", ids)
      .order("event_date", { ascending: true });

    if (eErr) {
      console.error(eErr);
      toast("Erreur chargement des événements");
      setLoadingList(false);
      return;
    }

    setItems((evs || []) as EventRow[]);
    setLoadingList(false);
  }

  async function handleCreate() {
    if (!canCreate) return;

    setCreating(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        toast("Connecte-toi d’abord");
        return;
      }

      const share_code = makeShareCode();
      const payload = {
        title: title.trim(),
        share_code,
        event_date: date || null,
        location: location?.trim() || null,
      };

      // 1) crée l’événement
      const { data: inserted, error: insErr } = await supabase
        .from("events")
        .insert(payload)
        .select("*")
        .single();

      if (insErr || !inserted) {
        console.error(insErr);
        toast("Oups, création impossible");
        return;
      }

      // 2) inscrit l’hôte dans event_members
      const { error: memErr } = await supabase.from("event_members").insert({
        event_id: inserted.id,
        user_id: auth.user.id,
        role: "host",
      });
      if (memErr) console.warn("member insert:", memErr);

      toast("Barbecue créé 🔥");

      // reset formulaire + refresh
      setTitle("");
      setDate("");
      setLocation("");
      await refreshEvents(auth.user.id);
    } catch (e) {
      console.error(e);
      toast("Oups, échec de création");
    } finally {
      setCreating(false);
    }
  }

  function eventLink(ev: EventRow) {
    return `/events/${ev.id}`;
  }

  async function copyShare(ev: EventRow) {
    const link = `${locationOrigin()}/join/${ev.share_code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("Lien copié ✅");
    } catch {
      toast("Impossible de copier");
    }
  }

  function locationOrigin() {
    // compatibilite SSR/Vite dev
    if (typeof window !== "undefined" && window.location) return window.location.origin;
    return "https://app.cheepo.fr";
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cheepo-charcoal">Mes événements</h1>
        <Link to="/" className="text-sm underline">← Accueil</Link>
      </header>

      {/* Créer un événement */}
      <section className="bg-cheepo-sand card rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Créer un barbecue</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Titre (ex : BBQ chez Paul)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type={dateInputType}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onFocus={onDateFocus}
            onBlur={onDateBlur}
            placeholder="jj/mm/aaaa"
            className="input"
            aria-label="Date de l’événement"
          />


          <input
            className="input"
            placeholder="Lieu (optionnel)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <LoaderButton onClick={handleCreate} loading={creating} disabled={!canCreate}>
            Créer
          </LoaderButton>
        </div>
      </section>

      {/* Liste des événements */}
      <section className="bg-cheepo-sand rounded-xl border card p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Tes barbecues</h2>

        {loadingList ? (
          <p className="text-sm text-cheepo-text-2">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-cheepo-text-2">Aucun événement pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((ev) => (
              <li key={ev.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={eventLink(ev)}
                    className="font-medium text-cheepo-charcoal hover:underline break-words"
                  >
                    {ev.title}
                  </Link>
                  <div className="text-sm text-cheepo-text-2">
                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : "Date à préciser"}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </div>
                </div>
                <div className="shrink-0 flex gap-2">
                  <button
                    onClick={() => copyShare(ev)}
                    className="btn btn-soft"
                    title="Copier le lien d’invitation"
                  >
                    Copier le lien
                  </button>

                  <Link
                    to={eventLink(ev)}
                    className="btn btn-primary"
                  >
                    Ouvrir
                  </Link>
                </div>

              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rejoindre via code */}
      <section className="bg-cheepo-sand card rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Rejoindre via code</h2>
        <p className="text-sm">
          Tu as reçu un code ? Va sur <Link to="/join/XXXXXX" className="underline">/join/TONCODE</Link> (remplace TONCODE).
        </p>
      </section>
    </div>
  );
}
