import LoaderButton from "./LoaderButton";
import type { ShoppingAddition } from "../lib/types";

export type ShoppingDraft = {
  label: string;
  unit: string;
  quantity: number;
};

type EditableShoppingManagerProps = {
  rows: ShoppingAddition[];
  ownerLabels: Map<string, string>;
  drafts: Record<string, ShoppingDraft>;
  loading: boolean;
  onDraftChange: (rowId: string, field: keyof ShoppingDraft, value: string | number) => void;
  onSave: (rowId: string) => Promise<void>;
  onDelete: (rowId: string) => Promise<void>;
};

export default function EditableShoppingManager({
  rows,
  ownerLabels,
  drafts,
  loading,
  onDraftChange,
  onSave,
  onDelete,
}: EditableShoppingManagerProps) {
  return (
    <section className="panel stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gestion hote</p>
          <h2>Toutes les courses manuelles</h2>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">Aucune course manuelle a corriger.</div>
      ) : (
        <div className="row-list">
          {rows.map((row) => {
            const draft = drafts[row.id] ?? {
              label: row.label,
              unit: row.unit,
              quantity: row.quantity,
            };

            return (
              <article key={row.id} className="row-card">
                <div className="stack-md">
                  <span>Ajoute par {ownerLabels.get(row.created_by) ?? "Participant"}</span>

                  <div className="grid-three">
                    <label className="field-block">
                      <span>Libelle</span>
                      <input
                        className="field-input"
                        value={draft.label}
                        onChange={(event) => onDraftChange(row.id, "label", event.target.value)}
                      />
                    </label>

                    <label className="field-block">
                      <span>Unite</span>
                      <input
                        className="field-input"
                        value={draft.unit}
                        onChange={(event) => onDraftChange(row.id, "unit", event.target.value)}
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
                          onDraftChange(row.id, "quantity", Number(event.target.value) || 1)
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="event-card-actions">
                  <LoaderButton
                    type="button"
                    tone="secondary"
                    loading={loading}
                    onClick={() => void onSave(row.id)}
                  >
                    Enregistrer
                  </LoaderButton>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={loading}
                    onClick={() => void onDelete(row.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
