import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import LoaderButton from "../components/LoaderButton";
import { toast } from "../lib/toast";

export default function JoinByCode() {
  const { code: initial } = useParams<{ code: string }>();
  const [code, setCode] = useState(initial ?? "");
  const [joining, setJoining] = useState(false);
  const nav = useNavigate();

  async function handleJoin() {
    const c = code.trim().toUpperCase();
    if (!c) return;

    setJoining(true);
    try {
      // s’assure qu’on est connecté (sinon la RLS bloquera)
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        toast("Connecte-toi pour rejoindre");
        nav("/");
        return;
      }

      // appelle la RPC (doit exister côté Supabase)
      const { data, error } = await supabase.rpc("join_event_by_code", { p_code: c });

      if (error) {
        console.error(error);
        toast("Code invalide ou déjà membre");
        return;
      }

      toast("Bienvenue ! 😋");
      // si la RPC renvoie l'id de l’event, redirige dessus
      const evId = Array.isArray(data) ? data?.[0]?.id ?? data?.[0]?.event_id : (data as any)?.id ?? (data as any)?.event_id;
      if (evId) nav(`/events/${evId}`);
      else nav("/events");
    } catch (e) {
      console.error(e);
      toast("Impossible de rejoindre");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cheepo-charcoal">Rejoindre un barbecue</h1>
        <Link to="/events" className="text-sm underline">← Mes événements</Link>
      </header>

      <section className="bg-cheepo-sand rounded-xl p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium">Code d’invitation</label>
        <input
          className="input"
          placeholder="Ex : A1B2C3"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={12}
        />
        <LoaderButton onClick={handleJoin} loading={joining} disabled={!code.trim()}>
          Rejoindre
        </LoaderButton>

        <p className="text-sm text-cheepo-text-2">
          Tu n’as pas de code ? Demande à l’hôte de te partager son lien.
        </p>
      </section>
    </div>
  );
}
