// src/pages/JoinByCode.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type EventRow = {
  id: string;
  title: string;
  share_code: string;
  event_date: string | null;
  location: string | null;
};

export default function JoinByCode() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("…");

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setMsg("Tu dois être connecté pour rejoindre un événement.");
        return;
      }
      if (!code) {
        setMsg("Code manquant.");
        return;
      }

      // Appel RPC sans génériques (plus robuste avec supabase-js v2)
      const { data, error } = await supabase.rpc("join_event_by_code", { p_code: code });

      if (error) {
        setMsg("Code invalide ou erreur : " + error.message);
        return;
      }

      const ev = data as EventRow | null;
      if (!ev || !ev.id) {
        setMsg("Code invalide.");
        return;
      }

      setMsg("Tu as rejoint l’événement ✅ Redirection…");
      setTimeout(() => navigate(`/events/${ev.id}`), 600);
    })();
  }, [code, navigate]);

  return (
    <div className="p-6 space-y-4">
      <p className="card p-4">{msg}</p>
      <Link to="/events" className="underline text-cheepo-link">← Mes événements</Link>
    </div>
  );
}
