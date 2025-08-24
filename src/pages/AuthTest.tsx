import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function AuthTest() {
  const [status, setStatus] = useState("…");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "Connecté" : "Non connecté");
    })();
  }, []);

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    setStatus(error ? "Erreur inscription: " + error.message : "Inscription envoyée (vérifie ton email si confirmation)");
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? "Erreur connexion: " + error.message : "Connecté !");
  }

  async function logout() {
    await supabase.auth.signOut();
    setStatus("Déconnecté");
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Test Supabase</h2>
        <Link to="/" className="underline text-cheepo-link">← Accueil</Link>
      </header>

      <div className="card p-6 space-y-4">
        <p className="text-cheepo-text2">Statut: <strong>{status}</strong></p>

        <form className="space-y-3" onSubmit={signup}>
          <div className="flex gap-2">
            <input className="card px-3 py-2 flex-1" type="email" placeholder="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
            <input className="card px-3 py-2 flex-1" type="password" placeholder="mot de passe" value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">S’inscrire</button>
            <button className="btn card" onClick={login} type="button">Se connecter</button>
            <button className="btn card" onClick={logout} type="button">Se déconnecter</button>
          </div>
        </form>
      </div>
    </div>
  );
}
