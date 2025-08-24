import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Page introuvable (404)</h2>
      <div className="card p-6 space-y-2">
        <p className="text-cheepo-text2">L’URL demandée n’existe pas.</p>
        <Link to="/" className="btn btn-primary inline-block w-max">Retour à l’accueil</Link>
      </div>
    </div>
  );
}
