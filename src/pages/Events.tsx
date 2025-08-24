import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type EventRow = {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  share_code: string;
  created_at: string;
};

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

export default function Events() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function loadEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id,title,event_date,location,share_code,created_at")
      .order("created_at", { ascending: false });
    if (error) setMsg("Erreur chargement: " + error.message);
    else setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return setMsg("Tu dois être connecté.");

    const { error } = await supabase.from("events").insert({
      host_id: userRes.user.id,
      title: title.trim(),
      event_date: date ? new Date(date).toISOString() : null,
      location: location.trim() || null,
    });
    if (error) setMsg("Erreur création: " + error.message);
    else {
      setTitle(""); setDate(""); setLocation("");
      setMsg("Événement créé 🎉");
      loadEvents();
    }
  }

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const codeTrim = code.trim();
    if (!codeTrim) return;
    const { error } = await supabase.rpc("join_event_by_code", { p_code: codeTrim });
    if (error) setMsg("Code invalide ou erreur: " + error.message);
    else {
      setMsg("Tu as rejoint l’événement ✅");
      setCode("");
      loadEvents();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mes événements</h2>
        <Link to="/" className="underline text-cheepo-link">← Accueil</Link>
      </header>

      {msg && <div className="card p-3 text-sm">{msg}</div>}

      {/* Création */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold">Créer un barbecue</h3>
        <form onSubmit={createEvent} className="space-y-3">
          <input className="card px-3 py-2 w-full" placeholder="Titre (ex : BBQ chez Paul)"
                 value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div className="flex gap-2">
            <input type="date" className="card px-3 py-2" value={date}
                   onChange={(e) => setDate(e.target.value)} />
            <input className="card px-3 py-2 flex-1" placeholder="Lieu (optionnel)"
                   value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Créer</button>
        </form>
      </div>

      {/* Rejoindre via code */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold">Rejoindre via code</h3>
        <form onSubmit={joinByCode} className="flex gap-2">
          <input className="card px-3 py-2 flex-1" placeholder="Code d’invitation (ex: a1b2c3d4)"
                 value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn card" type="submit">Rejoindre</button>
        </form>
      </div>

      {/* Liste */}
      <div className="card p-6">
        <h3 className="font-semibold mb-3">Tes barbecues</h3>
        {loading ? (
          <p className="text-cheepo-text2">Chargement…</p>
        ) : events.length === 0 ? (
          <p className="text-cheepo-text2">Aucun événement pour l’instant.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => {
              const inviteUrl = `${window.location.origin}/join/${ev.share_code}`;
              return (
                <li key={ev.id} className="flex items-center justify-between gap-3">
                  <div>
                    <Link to={`/events/${ev.id}`} className="underline text-cheepo-link">
                      {ev.title}
                    </Link>
                    <div className="text-sm text-cheepo-text2">
                      {ev.location ? ev.location + " · " : ""}
                      {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : "date à définir"}
                    </div>
                    <div className="text-xs text-cheepo-text2 mt-1">
                      Code : <code className="bg-cheepo-card px-2 py-0.5 rounded">{ev.share_code}</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn card"
                      onClick={async () => {
                        await copyToClipboard(inviteUrl);
                        setMsg("Lien copié 📋");
                        setTimeout(() => setMsg(null), 1200);
                      }}
                    >
                      Copier le lien
                    </button>
                    <Link to={`/events/${ev.id}`} className="btn btn-primary">Ouvrir</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
