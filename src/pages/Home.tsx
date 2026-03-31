import { Link } from "react-router-dom";
import { useSession } from "../lib/useSession";

export default function Home() {
  const { user } = useSession();

  return (
    <div className="landing-page">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="landing-nav">
        <div className="brand-mark">
          <span className="brand-dot" />
          <span>Cheepo</span>
        </div>

        <div className="landing-nav-actions">
          <Link to={user ? "/events" : "/auth"} className="btn btn-primary">
            {user ? "Ouvrir mon espace" : "Commencer"}
          </Link>
        </div>
      </header>

      <main className="landing-grid">
        <section className="hero-card">
          <p className="eyebrow">Organisation simple</p>
          <h1>Cheepo centralise ton evenement barbecue.</h1>
          <p className="hero-copy">
            Un seul endroit pour inviter les participants, suivre ce que chacun mange,
            voir ce que chacun apporte et garder une liste de courses claire.
          </p>

          <div className="hero-actions">
            <Link to={user ? "/events" : "/auth"} className="btn btn-primary">
              {user ? "Ouvrir mon espace" : "Commencer"}
            </Link>
            <Link to="/auth" className="btn btn-secondary">
              Se connecter
            </Link>
          </div>
        </section>

        <section className="panel stack-lg feature-panel">
          <div>
            <p className="eyebrow">Ce que tu retrouves</p>
            <h2>Une base simple pour repartir proprement</h2>
          </div>
          <p>
            Cheepo gere deja les evenements, les invitations, les repas, les apports,
            les courses et un journal des modifications. On peaufinera le design a la fin.
          </p>
        </section>
      </main>
    </div>
  );
}
