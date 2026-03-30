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
        <section className="hero-card hero-card-large">
          <p className="eyebrow">Barbecue sans charge mentale</p>
          <h1>Une appli legere pour coordonner qui vient, qui mange et qui apporte quoi.</h1>
          <p className="hero-copy">
            Plus de tableau perdu dans WhatsApp. Cheepo centralise l evenement, les besoins
            du groupe et la liste de courses restante en un seul endroit.
          </p>

          <div className="hero-actions">
            <Link to={user ? "/events" : "/auth"} className="btn btn-primary">
              {user ? "Reprendre mon tableau de bord" : "Creer mon premier barbecue"}
            </Link>
            <Link to="/auth" className="btn btn-secondary">
              Se connecter
            </Link>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <strong>1 lien</strong>
              <span>pour inviter tout le monde</span>
            </div>
            <div className="stat-card">
              <strong>3 espaces</strong>
              <span>manger, apporter, courses</span>
            </div>
            <div className="stat-card">
              <strong>0 flou</strong>
              <span>sur ce qu il reste a prevoir</span>
            </div>
          </div>
        </section>

        <section className="stack-lg">
          <article className="panel feature-panel">
            <p className="eyebrow">Creer</p>
            <h2>Un evenement en quelques secondes</h2>
            <p>
              Donne un titre, une date et un lieu. Cheepo genere automatiquement un code de
              partage et garde l hote comme referent de l evenement.
            </p>
          </article>

          <article className="panel feature-panel">
            <p className="eyebrow">Coordonner</p>
            <h2>Le groupe voit la meme realite</h2>
            <p>
              Les participants indiquent ce qu ils prevoient de manger, ce qu ils apportent
              et la liste de courses se met a jour a partir de ces choix.
            </p>
          </article>

          <article className="panel feature-panel">
            <p className="eyebrow">Partager</p>
            <h2>Rejoindre avec un simple code</h2>
            <p>
              Pas besoin d administration lourde. Un lien d invitation suffit pour integrer
              un participant au bon evenement.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
