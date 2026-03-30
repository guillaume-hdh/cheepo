import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import LoaderButton from "../components/LoaderButton";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";
import type { AdminEventOverview } from "../lib/types";
import { asAdminEventRows, formatEventDate, formatTimestamp } from "../lib/utils";

export default function SuperAdminPage() {
  const [events, setEvents] = useState<AdminEventOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  useEffect(() => {
    void loadEvents(submittedSearch);
  }, [submittedSearch]);

  async function loadEvents(searchValue: string) {
    setLoading(true);

    const { data, error } = await supabase.rpc("admin_list_events", {
      p_search: searchValue.trim() || null,
    });

    setLoading(false);

    if (error) {
      toast(error.message);
      return;
    }

    setEvents(asAdminEventRows(data));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search);
  }

  return (
    <AppShell
      title="Super-Admin"
      subtitle="Vue globale de la plateforme pour ouvrir n importe quel evenement, controler les donnees et corriger rapidement si besoin."
      actions={
        <div className="hero-actions">
          <span className="pill">{events.length} evenement{events.length > 1 ? "s" : ""}</span>
          <Link to="/events" className="btn btn-ghost">
            Retour dashboard
          </Link>
        </div>
      }
    >
      <section className="panel stack-lg">
        <form className="grid-two" onSubmit={handleSearch}>
          <label className="field-block">
            <span>Recherche</span>
            <input
              className="field-input"
              value={search}
              onChange={(searchEvent) => setSearch(searchEvent.target.value)}
              placeholder="Titre, code, hote, email, lieu..."
            />
          </label>

          <div className="field-block">
            <span>Action</span>
            <LoaderButton type="submit" loading={loading}>
              Rechercher
            </LoaderButton>
          </div>
        </form>
      </section>

      <section className="panel stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plateforme</p>
            <h2>Tous les evenements</h2>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Chargement des evenements...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">Aucun evenement ne correspond a la recherche.</div>
        ) : (
          <div className="event-list">
            {events.map((event) => (
              <article key={event.id} className="event-card">
                <div className="event-card-copy">
                  <div className="event-card-topline">
                    <span className="pill">Code {event.share_code}</span>
                    <span className="pill pill-soft">{event.member_count} membre{event.member_count > 1 ? "s" : ""}</span>
                  </div>

                  <h3>{event.title}</h3>
                  <p>{event.description || "Aucune description."}</p>

                  <dl className="meta-grid">
                    <div>
                      <dt>Hote</dt>
                      <dd>{event.host_name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{event.host_email || "Non renseigne"}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{formatEventDate(event.event_date)}</dd>
                    </div>
                    <div>
                      <dt>Cree le</dt>
                      <dd>{formatTimestamp(event.created_at)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="event-card-actions">
                  <Link to={`/events/${event.id}`} className="btn btn-primary">
                    Ouvrir l evenement
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
