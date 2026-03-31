import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PENDING_JOIN_CODE_KEY } from "../lib/constants";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import { extractUuid, friendlyErrorMessage, normalizeInviteCode } from "../lib/utils";

export default function JoinByCodePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { loading, user } = useSession();
  const [message, setMessage] = useState("Preparation...");

  useEffect(() => {
    if (loading) {
      return;
    }

    const normalizedCode = normalizeInviteCode(code ?? "");

    if (!normalizedCode) {
      setMessage("Code d invitation manquant.");
      return;
    }

    if (!user) {
      localStorage.setItem(PENDING_JOIN_CODE_KEY, normalizedCode);
      navigate("/auth", {
        replace: true,
        state: {
          from: `/join/${normalizedCode}`,
        },
      });
      return;
    }

    let active = true;

    async function joinEvent() {
      setMessage("Connexion a l evenement...");

      const { data, error } = await supabase.rpc("join_event_by_code", {
        p_code: normalizedCode,
      });

      if (!active) {
        return;
      }

      if (error) {
        setMessage(friendlyErrorMessage(error.message));
        return;
      }

      const joinedEventId = extractUuid(data);

      if (!joinedEventId) {
        setMessage("La reponse du serveur est incomplete.");
        return;
      }

      setMessage("Invitation acceptee. Redirection...");
      navigate(`/events/${joinedEventId}`, { replace: true });
    }

    void joinEvent();

    return () => {
      active = false;
    };
  }, [code, loading, navigate, user]);

  return (
    <div className="centered-state">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="panel stack-lg join-panel">
        <p className="eyebrow">Invitation</p>
        <h1>Rejoindre un barbecue</h1>
        <p>{message}</p>
        <div className="hero-actions">
          <Link to="/events" className="btn btn-secondary">
            Retour au tableau de bord
          </Link>
          <Link to="/" className="btn btn-ghost">
            Retour accueil
          </Link>
        </div>
      </section>
    </div>
  );
}
