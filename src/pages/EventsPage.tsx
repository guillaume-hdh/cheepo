import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import DateTimeFields from "../components/DateTimeFields";
import LoaderButton from "../components/LoaderButton";
import { toast } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import type { EventSummary } from "../lib/types";
import {
  asEventRows,
  buildShareLink,
  combineDateTimeInput,
  copyText,
  extractUuid,
  formatEventDate,
  formatTimestamp,
  friendlyErrorMessage,
  normalizeInviteCode,
} from "../lib/utils";

export default function EventsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadEvents();
  }, [user]);

  async function loadEvents() {
    setLoading(true);

    const { data, error } = await supabase
      .from("events")
      .select("id,title,description,location,event_date,share_code,host_id,status,archived_at,created_at")
      .order("status", { ascending: true })
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      toast("Impossible de charger les evenements");
      return;
    }

    setEvents(asEventRows(data));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      toast("Ajoute au moins un titre");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase.rpc("create_event", {
      p_title: title.trim(),
      p_event_date: combineDateTimeInput(eventDate, eventTime),
      p_location: location.trim() || null,
      p_description: description.trim() || null,
    });

    setCreating(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    setTitle("");
    setEventDate("");
    setEventTime("19:00");
    setLocation("");
    setDescription("");
    toast("Barbecue cree");
    await loadEvents();

    const newEventId = extractUuid(data);
    if (newEventId) {
      navigate(`/events/${newEventId}`);
    }
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = normalizeInviteCode(joinCode);
    if (!normalized) {
      toast("Entre un code");
      return;
    }

    navigate(`/join/${normalized}`);
  }

  async function handleCopyInvite(code: string) {
    const copied = await copyText(buildShareLink(code));

    if (!copied) {
      toast("Impossible de copier le lien");
      return;
    }

    toast("Lien copie");
  }

  return (
    <AppShell
      title="Tableau de bord"
      subtitle="Cree un nouvel evenement, rejoins un barbecue existant et retrouve rapidement les invitations deja partagees."
      actions={
        <div className="hero-actions">
          <span className="pill pill-soft">
            {events.length} evenement{events.length > 1 ? "s" : ""}
          </span>
        </div>
      }
    >
      <div className="dashboard-grid">
        <section className="panel stack-lg">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Creer</p>
              <h2>Nouveau barbecue</h2>
            </div>
          </div>

          <form className="stack-md" onSubmit={handleCreate}>
            <label className="field-block">
              <span>Titre</span>
              <input
                className="field-input"
                value={title}
                onChange={(nextEvent) => setTitle(nextEvent.target.value)}
                placeholder="BBQ du samedi soir"
                required
              />
            </label>

            <DateTimeFields
              dateValue={eventDate}
              timeValue={eventTime}
              onDateChange={setEventDate}
              onTimeChange={setEventTime}
            />

            <label className="field-block">
              <span>Lieu</span>
              <input
                className="field-input"
                value={location}
                onChange={(nextEvent) => setLocation(nextEvent.target.value)}
                placeholder="Terrasse, parc, jardin..."
              />
            </label>

            <label className="field-block">
              <span>Notes</span>
              <textarea
                className="field-input field-textarea"
                value={description}
                onChange={(nextEvent) => setDescription(nextEvent.target.value)}
                placeholder="Ex : chacun ramene sa boisson, charbon deja prevu..."
              />
            </label>

            <LoaderButton type="submit" loading={creating}>
              Creer l evenement
            </LoaderButton>
          </form>
        </section>

        <section className="panel stack-lg">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Rejoindre</p>
              <h2>Avec un code</h2>
            </div>
          </div>

          <form className="stack-md" onSubmit={handleJoin}>
            <label className="field-block">
              <span>Code d invitation</span>
              <input
                className="field-input"
                value={joinCode}
                onChange={(nextEvent) => setJoinCode(nextEvent.target.value)}
                placeholder="Ex : A1B2C3"
                maxLength={12}
              />
            </label>

            <LoaderButton type="submit" tone="secondary">
              Rejoindre l evenement
            </LoaderButton>
          </form>

          <div className="callout">
            Si quelqu un t envoie un lien complet, il suffit aussi d ouvrir directement
            l URL de type <code>/join/CODE</code>.
          </div>
        </section>
      </div>

      <section className="panel stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Mes evenements</p>
            <h2>Ce que tu suis deja</h2>
          </div>
          <Link to="/" className="btn btn-ghost">
            Voir l accueil
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">Chargement des evenements...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            Aucun barbecue pour l instant. Cree le premier ou rejoins-en un avec un code.
          </div>
        ) : (
          <div className="event-list">
            {events.map((event) => {
              const isHost = event.host_id === user?.id;

              return (
                <article key={event.id} className="event-card">
                  <div className="event-card-copy">
                    <div className="event-card-topline">
                      <span className="pill">{isHost ? "Hote" : "Participant"}</span>
                      {event.status === "archived" ? <span className="pill">Archive</span> : null}
                      <span className="pill pill-soft">Code {event.share_code}</span>
                    </div>

                    <h3>{event.title}</h3>
                    <p>{event.description || "Aucune note ajoutee pour le moment."}</p>

                    <dl className="meta-grid">
                      <div>
                        <dt>Date</dt>
                        <dd>{formatEventDate(event.event_date)}</dd>
                      </div>
                      <div>
                        <dt>Lieu</dt>
                        <dd>{event.location || "A confirmer"}</dd>
                      </div>
                      <div>
                        <dt>Cree le</dt>
                        <dd>{formatTimestamp(event.created_at)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="event-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void handleCopyInvite(event.share_code)}
                    >
                      Copier le lien
                    </button>

                    <Link to={`/events/${event.id}`} className="btn btn-primary">
                      Ouvrir
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
