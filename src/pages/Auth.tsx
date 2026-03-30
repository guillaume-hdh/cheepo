import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoaderButton from "../components/LoaderButton";
import { PENDING_JOIN_CODE_KEY } from "../lib/constants";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { normalizeInviteCode } from "../lib/utils";

type AuthMode = "login" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user } = useSession();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const redirectTo =
    typeof location.state === "object" && location.state && "from" in location.state
      ? String(location.state.from)
      : "/events";

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const pendingCode = localStorage.getItem(PENDING_JOIN_CODE_KEY);

    if (pendingCode) {
      localStorage.removeItem(PENDING_JOIN_CODE_KEY);
      navigate(`/join/${normalizeInviteCode(pendingCode)}`, { replace: true });
      return;
    }

    navigate(redirectTo, { replace: true });
  }, [loading, navigate, redirectTo, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setBusy(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || null,
          },
        },
      });

      setBusy(false);

      if (error) {
        setFeedback(error.message);
        return;
      }

      if (!data.session) {
        setFeedback("Compte cree. Verifie ta boite mail si la confirmation est activee.");
        return;
      }

      setFeedback("Compte pret. Redirection...");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setFeedback(error.message);
      return;
    }

    setFeedback("Connexion reussie. Redirection...");
  }

  return (
    <div className="auth-page">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <div className="auth-grid">
        <section className="hero-card">
          <p className="eyebrow">Nouvelle base propre</p>
          <h1>Reconnecte-toi et on repart sur une V1 saine.</h1>
          <p className="hero-copy">
            Cheepo te permet de creer un barbecue, partager un lien d invitation, savoir
            ce que chacun mange, ce que chacun apporte et ce qu il reste a acheter.
          </p>

          <div className="feature-list">
            <div className="feature-card">
              <strong>Evenements partages</strong>
              <span>Un code, un lien, et tout le monde rejoint le meme barbecue.</span>
            </div>
            <div className="feature-card">
              <strong>Organisation claire</strong>
              <span>Repas, contributions et courses restent synchronises.</span>
            </div>
            <div className="feature-card">
              <strong>Base versionnee</strong>
              <span>Le schema Supabase repart dans le repo, plus hors controle.</span>
            </div>
          </div>
        </section>

        <section className="panel auth-panel stack-lg">
          <div className="tab-row">
            <button
              type="button"
              className={mode === "signup" ? "tab tab-active" : "tab"}
              onClick={() => setMode("signup")}
            >
              Creer un compte
            </button>
            <button
              type="button"
              className={mode === "login" ? "tab tab-active" : "tab"}
              onClick={() => setMode("login")}
            >
              Se connecter
            </button>
          </div>

          <form className="stack-lg" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <label className="field-block">
                <span>Nom affiche</span>
                <input
                  className="field-input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Ex : Guillaume"
                />
              </label>
            ) : null}

            <label className="field-block">
              <span>Email</span>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ton@email.fr"
                required
              />
            </label>

            <label className="field-block">
              <span>Mot de passe</span>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Au moins 6 caracteres"
                minLength={6}
                required
              />
            </label>

            {feedback ? <p className="callout">{feedback}</p> : null}

            <LoaderButton type="submit" loading={busy} fullWidth>
              {mode === "signup" ? "Creer mon compte" : "Entrer dans Cheepo"}
            </LoaderButton>
          </form>

          <p className="meta-copy">
            Retour a <Link to="/">l accueil</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
