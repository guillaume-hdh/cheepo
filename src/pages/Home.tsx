import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cheepo</h1>
        <Link to="/events" className="btn btn-primary">Voir mes événements</Link>
      </header>
      <section className="card p-6 space-y-2">
        <h2 className="text-xl font-semibold">Bienvenue 👋</h2>
        <p className="text-cheepo-text2">Organise ton barbecue sans prise de tête.</p>
      </section>
    </div>
  );
}
