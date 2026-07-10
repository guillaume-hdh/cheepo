import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoaderButton from "../components/LoaderButton";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { loading, user } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (password.length < 6) {
      setFeedback("Le mot de passe doit faire au moins 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setBusy(false);
      setFeedback(error.message);
      return;
    }

    await supabase.auth.signOut({ scope: "global" });
    setBusy(false);
    navigate("/auth", { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <div className="auth-grid">
        <section className="hero-card">
          <p className="eyebrow">Securite</p>
          <h1>Nouveau mot de passe.</h1>
          <p className="hero-copy">
            Definis un nouveau mot de passe pour ton compte Cheepo. Tu devras te
            reconnecter ensuite.
          </p>
        </section>

        <section className="panel auth-panel stack-lg">
          {loading ? (
            <div className="empty-state">Verification du lien...</div>
          ) : !user ? (
            <div className="stack-md">
              <div className="empty-state">
                Ce lien est invalide ou expire. Demande un nouveau lien depuis la page
                de connexion.
              </div>
              <Link to="/auth" className="btn btn-primary">
                Retour a la connexion
              </Link>
            </div>
          ) : (
            <form className="stack-lg" onSubmit={handleSubmit}>
              <label className="field-block">
                <span>Nouveau mot de passe</span>
                <input
                  className="field-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>

              <label className="field-block">
                <span>Confirmation</span>
                <input
                  className="field-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>

              {feedback ? <p className="callout">{feedback}</p> : null}

              <LoaderButton type="submit" loading={busy} fullWidth>
                Enregistrer le mot de passe
              </LoaderButton>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
