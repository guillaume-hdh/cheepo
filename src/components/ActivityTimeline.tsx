import type { ActivityLogRow } from "../lib/types";
import { formatTimestamp } from "../lib/utils";

type ActivityTimelineProps = {
  logs: ActivityLogRow[];
};

function summarizeSnapshot(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return null;
  }

  const orderedKeys = ["title", "event_date", "location", "description", "label", "quantity", "unit", "role"];
  const details = orderedKeys
    .filter((key) => key in snapshot && snapshot[key] != null && `${snapshot[key]}` !== "")
    .map((key) => `${key}: ${snapshot[key]}`);

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
                {log.actor_name || "System"} - {formatTimestamp(log.created_at)}
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
