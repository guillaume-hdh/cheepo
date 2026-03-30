import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="centered-state">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="panel stack-lg join-panel">
        <p className="eyebrow">404</p>
        <h1>Cette page n existe pas.</h1>
        <p>
          Si tu cherchais un evenement, retourne au tableau de bord ou repars depuis l accueil.
        </p>
        <div className="hero-actions">
          <Link to="/events" className="btn btn-primary">
            Aller au tableau de bord
          </Link>
          <Link to="/" className="btn btn-secondary">
            Retour accueil
          </Link>
        </div>
      </section>
    </div>
  );
}
