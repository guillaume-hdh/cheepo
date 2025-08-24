import { Link } from "react-router-dom";

export default function Profile() {
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mon profil</h2>
        <Link to="/" className="underline text-cheepo-link">← Accueil</Link>
      </header>
      <div className="card p-6">
        <p className="text-cheepo-text2">Nom affiché, avatar (initiales)… bientôt ici.</p>
      </div>
    </div>
  );
}
