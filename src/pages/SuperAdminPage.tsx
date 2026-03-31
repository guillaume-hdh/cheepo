import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import LoaderButton from "../components/LoaderButton";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";
import type {
  AdminEventOverview,
  AdminOverviewStats,
  AdminUserEvent,
  AdminUserOverview,
} from "../lib/types";
import {
  asAdminEventRows,
  asAdminOverviewStats,
  asAdminUserEventRows,
  asAdminUserRows,
  buildMailtoLink,
  formatEventDate,
  formatQuantity,
  formatTimestamp,
  friendlyErrorMessage,
} from "../lib/utils";

export default function SuperAdminPage() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [events, setEvents] = useState<AdminEventOverview[]>([]);
  const [accounts, setAccounts] = useState<AdminUserOverview[]>([]);
  const [userEventsById, setUserEventsById] = useState<Record<string, AdminUserEvent[]>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState("");
  const [submittedEventSearch, setSubmittedEventSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [submittedAccountSearch, setSubmittedAccountSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    void loadEvents(submittedEventSearch);
  }, [submittedEventSearch]);

  useEffect(() => {
    void loadAccounts(submittedAccountSearch);
  }, [submittedAccountSearch]);

  async function loadOverview() {
    setStatsLoading(true);

    const { data, error } = await supabase.rpc("admin_get_overview_stats", {});

    setStatsLoading(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    setStats(asAdminOverviewStats(data));
  }

  async function loadEvents(searchValue: string) {
    setEventsLoading(true);

    const { data, error } = await supabase.rpc("admin_list_events", {
      p_search: searchValue.trim() || null,
    });

    setEventsLoading(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    setEvents(asAdminEventRows(data));
  }

  async function loadAccounts(searchValue: string) {
    setAccountsLoading(true);

    const { data, error } = await supabase.rpc("admin_list_accounts", {
      p_search: searchValue.trim() || null,
    });

    setAccountsLoading(false);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    setAccounts(asAdminUserRows(data));
  }

  function handleEventSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedEventSearch(eventSearch);
  }

  function handleAccountSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedAccountSearch(accountSearch);
  }

  async function handleToggleAccount(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(userId);

    if (userEventsById[userId]) {
      return;
    }

    const { data, error } = await supabase.rpc("admin_list_account_events", {
      p_user_id: userId,
    });

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    setUserEventsById((current) => ({
      ...current,
      [userId]: asAdminUserEventRows(data),
    }));
  }

  async function handleAccountBan(account: AdminUserOverview, banned: boolean) {
    setWorkingUserId(account.user_id);

    const { error } = await supabase.rpc("admin_set_user_ban", {
      p_user_id: account.user_id,
      p_banned: banned,
      p_reason: banReasons[account.user_id]?.trim() || null,
    });

    setWorkingUserId(null);

    if (error) {
      toast(friendlyErrorMessage(error.message));
      return;
    }

    toast(banned ? "Compte suspendu" : "Compte reactive");
    await loadOverview();
    await loadAccounts(submittedAccountSearch);
  }

  return (
    <AppShell
      tone="admin"
      title="Super-Admin"
      subtitle="Pilotage global de la plateforme pour surveiller les evenements, les comptes et intervenir rapidement si besoin."
      actions={
        <div className="hero-actions">
          <span className="pill">
            {stats?.total_events ?? events.length} evenement{(stats?.total_events ?? events.length) > 1 ? "s" : ""}
          </span>
          <span className="pill pill-soft">
            {stats?.total_accounts ?? accounts.length} compte{(stats?.total_accounts ?? accounts.length) > 1 ? "s" : ""}
          </span>
          <Link to="/events" className="btn btn-ghost">
            Retour dashboard
          </Link>
        </div>
      }
    >
      <section className="panel stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vue plateforme</p>
            <h2>Indicateurs utiles</h2>
          </div>
        </div>

        {statsLoading ? (
          <div className="empty-state">Chargement des indicateurs...</div>
        ) : !stats ? (
          <div className="empty-state">Impossible de charger les indicateurs.</div>
        ) : (
          <div className="stats-grid">
            <article className="stat-panel">
              <strong>{stats.total_events}</strong>
              <span>Evenements total</span>
            </article>
            <article className="stat-panel">
              <strong>{stats.active_events}</strong>
              <span>Evenements actifs</span>
            </article>
            <article className="stat-panel">
              <strong>{stats.archived_events}</strong>
              <span>Evenements archives</span>
            </article>
            <article className="stat-panel">
              <strong>{stats.total_accounts}</strong>
              <span>Comptes inscrits</span>
            </article>
            <article className="stat-panel">
              <strong>{formatQuantity(stats.average_members_per_event)}</strong>
              <span>Membres moyens par event</span>
            </article>
            <article className="stat-panel">
              <strong>{stats.pending_invitations}</strong>
              <span>Invitations en attente</span>
            </article>
          </div>
        )}
      </section>

      <section className="panel stack-lg">
        <form className="grid-two" onSubmit={handleEventSearch}>
          <label className="field-block">
            <span>Recherche</span>
            <input
              className="field-input"
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              placeholder="Titre, code, hote, email, lieu..."
            />
          </label>

          <div className="field-block">
            <span>Action</span>
            <LoaderButton type="submit" loading={eventsLoading}>
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

        {eventsLoading ? (
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
                    <span className="pill">{event.status === "archived" ? "Archive" : "Actif"}</span>
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

      <section className="panel stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Comptes</p>
            <h2>Utilisateurs inscrits</h2>
          </div>
        </div>

        <form className="grid-two" onSubmit={handleAccountSearch}>
          <label className="field-block">
            <span>Recherche compte</span>
            <input
              className="field-input"
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Nom, email..."
            />
          </label>

          <div className="field-block">
            <span>Action</span>
            <LoaderButton type="submit" loading={accountsLoading}>
              Filtrer
            </LoaderButton>
          </div>
        </form>

        {accountsLoading ? (
          <div className="empty-state">Chargement des comptes...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">Aucun compte ne correspond a la recherche.</div>
        ) : (
          <div className="account-grid">
            {accounts.map((account) => {
              const isExpanded = expandedUserId === account.user_id;
              const userEvents = userEventsById[account.user_id] ?? [];
              const emailHref = account.email ? buildMailtoLink(account.email, "Cheepo", "") : null;

              return (
                <article key={account.user_id} className="admin-user-card">
                  <div className="section-heading">
                    <div className="stack-md">
                      <div className="event-card-topline">
                        {account.is_platform_admin ? <span className="pill">Super-Admin</span> : null}
                        {account.is_banned ? <span className="pill">Banni</span> : null}
                        {account.hosted_events > 0 ? <span className="pill pill-soft">Hote</span> : null}
                        {account.member_events > 0 ? <span className="pill pill-soft">Membre</span> : null}
                        {account.pending_invitations > 0 ? <span className="pill pill-soft">Invite</span> : null}
                      </div>
                      <h3>{account.display_name}</h3>
                      <span>{account.email || "Email non renseigne"}</span>
                    </div>

                    <div className="event-card-actions">
                      {emailHref ? (
                        <a className="btn btn-secondary" href={emailHref}>
                          Ecrire
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleToggleAccount(account.user_id)}
                      >
                        {isExpanded ? "Masquer" : "Details"}
                      </button>
                    </div>
                  </div>

                  <dl className="meta-grid">
                    <div>
                      <dt>Cree le</dt>
                      <dd>{formatTimestamp(account.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Events en hote</dt>
                      <dd>{account.hosted_events}</dd>
                    </div>
                    <div>
                      <dt>Events rejoints</dt>
                      <dd>{account.member_events}</dd>
                    </div>
                    <div>
                      <dt>Invitations en attente</dt>
                      <dd>{account.pending_invitations}</dd>
                    </div>
                  </dl>

                  <label className="field-block">
                    <span>Note admin / raison</span>
                    <textarea
                      className="field-input field-textarea"
                      value={banReasons[account.user_id] ?? account.ban_reason ?? ""}
                      onChange={(event) =>
                        setBanReasons((current) => ({
                          ...current,
                          [account.user_id]: event.target.value,
                        }))
                      }
                      placeholder="Ex : spam, compte test, demande utilisateur..."
                    />
                  </label>

                  {account.is_banned && account.banned_at ? (
                    <div className="callout">
                      Suspendu le {formatTimestamp(account.banned_at)}
                      {account.ban_reason ? ` - ${account.ban_reason}` : ""}
                    </div>
                  ) : null}

                  <div className="event-card-actions">
                    <LoaderButton
                      type="button"
                      tone="secondary"
                      loading={workingUserId === account.user_id}
                      onClick={() => void handleAccountBan(account, !account.is_banned)}
                    >
                      {account.is_banned ? "Lever le ban" : "Bannir"}
                    </LoaderButton>
                  </div>

                  {isExpanded ? (
                    <div className="stack-md">
                      <h3>Ses evenements</h3>
                      {userEvents.length === 0 ? (
                        <div className="empty-state">Aucun evenement rattache a ce compte.</div>
                      ) : (
                        <div className="row-list">
                          {userEvents.map((userEvent) => (
                            <article key={`${account.user_id}-${userEvent.event_id}`} className="row-card">
                              <div>
                                <strong>{userEvent.title}</strong>
                                <span>
                                  {userEvent.role === "host" ? "Hote" : "Membre"} -{" "}
                                  {userEvent.status === "archived" ? "Archive" : "Actif"}
                                </span>
                                <span>
                                  {formatEventDate(userEvent.event_date)}
                                  {userEvent.location ? ` - ${userEvent.location}` : ""}
                                </span>
                              </div>

                              <div className="event-card-actions">
                                <span className="pill pill-soft">Code {userEvent.share_code}</span>
                                <Link to={`/events/${userEvent.event_id}`} className="btn btn-primary">
                                  Ouvrir
                                </Link>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
