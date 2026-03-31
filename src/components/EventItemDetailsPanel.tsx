import LoaderButton from "./LoaderButton";
import type { ChoiceRow, ShoppingAddition } from "../lib/types";
import { formatQuantity, formatTimestamp } from "../lib/utils";

export type ChoiceDraft = {
  label: string;
  unit: string;
  quantity: number;
};

export type ShoppingDraft = {
  label: string;
  unit: string;
  quantity: number;
};

type BaseProps = {
  title: string;
  itemLabel: string;
  itemUnit: string;
  ownerLabels: Map<string, string>;
  currentUserId?: string;
  canManageAll: boolean;
  loading: boolean;
};

type ChoiceDetailsProps = BaseProps & {
  mode: "choice";
  rows: ChoiceRow[];
  drafts: Record<string, ChoiceDraft>;
  onDraftChange: (rowId: string, field: keyof ChoiceDraft, value: string | number) => void;
  onSave: (rowId: string) => Promise<void>;
  onDelete: (rowId: string) => Promise<void>;
};

type ShoppingDetailsProps = BaseProps & {
  mode: "shopping";
  rows: ShoppingAddition[];
  drafts: Record<string, ShoppingDraft>;
  onDraftChange: (rowId: string, field: keyof ShoppingDraft, value: string | number) => void;
  onSave: (rowId: string) => Promise<void>;
  onDelete: (rowId: string) => Promise<void>;
};

type EventItemDetailsPanelProps = ChoiceDetailsProps | ShoppingDetailsProps;

export default function EventItemDetailsPanel(props: EventItemDetailsPanelProps) {
  const { title, itemLabel, itemUnit, ownerLabels, currentUserId, canManageAll, loading } = props;

  return (
    <section className="panel stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Details</p>
          <h2>{title}</h2>
        </div>
        <span className="pill pill-soft">
          {itemLabel} - {itemUnit}
        </span>
      </div>

      {props.rows.length === 0 ? (
        <div className="empty-state">Aucune ligne detaillee pour cet article.</div>
      ) : (
        <div className="row-list">
          {props.rows.map((row) => {
            const ownerId =
              props.mode === "choice"
                ? (row as ChoiceRow).user_id
                : (row as ShoppingAddition).created_by;
            const ownerName = ownerLabels.get(ownerId) ?? "Participant";
            const canEdit = canManageAll || ownerId === currentUserId;
            const draft =
              props.mode === "choice"
                ? props.drafts[row.id] ?? {
                    label: row.label,
                    unit: row.unit,
                    quantity: row.quantity,
                  }
                : props.drafts[row.id] ?? {
                    label: row.label,
                    unit: row.unit,
                    quantity: row.quantity,
                  };

            return (
              <article key={row.id} className="detail-card">
                <div className="detail-card-header">
                  <div className="stack-md">
                    <strong>{ownerName}</strong>
                    <span>Ajoute le {formatTimestamp(row.created_at)}</span>
                  </div>

                  <span className="pill">
                    {formatQuantity(row.quantity)} {row.unit}
                  </span>
                </div>

                {canEdit ? (
                  <>
                    <div className="grid-three">
                      <label className="field-block">
                        <span>Libelle</span>
                        <input
                          className="field-input"
                          value={draft.label}
                          onChange={(event) =>
                            props.onDraftChange(row.id, "label", event.target.value)
                          }
                        />
                      </label>

                      <label className="field-block">
                        <span>Unite</span>
                        <input
                          className="field-input"
                          value={draft.unit}
                          onChange={(event) =>
                            props.onDraftChange(row.id, "unit", event.target.value)
                          }
                        />
                      </label>

                      <label className="field-block">
                        <span>Quantite</span>
                        <input
                          className="field-input"
                          type="number"
                          min="1"
                          step="1"
                          value={draft.quantity}
                          onChange={(event) =>
                            props.onDraftChange(row.id, "quantity", Number(event.target.value) || 1)
                          }
                        />
                      </label>
                    </div>

                    <div className="event-card-actions">
                      <LoaderButton
                        type="button"
                        tone="secondary"
                        loading={loading}
                        onClick={() => void props.onSave(row.id)}
                      >
                        Enregistrer
                      </LoaderButton>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={loading}
                        onClick={() => void props.onDelete(row.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="callout">
                    {ownerName} a declare {formatQuantity(row.quantity)} {row.unit}.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
