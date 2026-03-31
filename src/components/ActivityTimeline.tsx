import type { ActivityLogRow } from "../lib/types";
import { formatEventDate, formatTimestamp } from "../lib/utils";

type ActivityTimelineProps = {
  logs: ActivityLogRow[];
};

function summarizeSnapshot(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return null;
  }

  const labels = new Map<string, string>([
    ["title", "Titre"],
    ["event_date", "Date"],
    ["location", "Lieu"],
    ["description", "Description"],
    ["label", "Libelle"],
    ["quantity", "Quantite"],
    ["unit", "Unite"],
    ["role", "Role"],
    ["status", "Statut"],
  ]);
  const orderedKeys = ["title", "event_date", "location", "description", "label", "quantity", "unit", "role", "status"];
  const details = orderedKeys
    .filter((key) => key in snapshot && snapshot[key] != null && `${snapshot[key]}` !== "")
    .map((key) => {
      const rawValue = `${snapshot[key]}`;

      if (key === "role") {
        return `${labels.get(key)}: ${rawValue === "host" ? "Hote" : "Participant"}`;
      }

      if (key === "status") {
        return `${labels.get(key)}: ${rawValue === "archived" ? "Archive" : "Actif"}`;
      }

      if (key === "event_date") {
        return `${labels.get(key)}: ${formatEventDate(rawValue)}`;
      }

      return `${labels.get(key) ?? key}: ${rawValue}`;
    });

  return details.length > 0 ? details.join(" | ") : null;
}

export default function ActivityTimeline({ logs }: ActivityTimelineProps) {
  if (logs.length === 0) {
    return <div className="empty-state">Aucune modification enregistree pour le moment.</div>;
  }

  return (
    <div className="row-list">
      {logs.map((log) => {
        const oldSummary = summarizeSnapshot(log.old_values);
        const newSummary = summarizeSnapshot(log.new_values);

        return (
          <article key={log.id} className="row-card">
            <div>
              <strong>{log.summary}</strong>
              <span>
                {log.actor_name || "Systeme"} - {formatTimestamp(log.created_at)}
              </span>
              {oldSummary ? <span>Avant: {oldSummary}</span> : null}
              {newSummary ? <span>Apres: {newSummary}</span> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
