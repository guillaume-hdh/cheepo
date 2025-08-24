import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type CatalogItem = {
  id: string;
  label: string;
  category: string;
  unit: string;
};

type EatRow = {
  id: string;
  event_id: string;
  user_id: string;
  label: string;
  category: string | null;
  unit: string;
  quantity: number;
  catalog_item_id: string | null;
};

type BringRow = {
  id: string;
  event_id: string;
  user_id: string;
  label: string;
  category: string | null;
  unit: string;
  quantity: number;
  catalog_item_id: string | null;
  is_done: boolean;
};

type RemainingRow = {
  event_id: string;
  label: string;
  unit: string;
  needed: number;
  brought: number;
  remaining: number;
};

type EventRow = {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  share_code: string | null; // <-- pour le bouton Partager
};

function groupTotals<T extends { label: string; unit: string; quantity: number }>(rows: T[]) {
  const byKey = new Map<string, { label: string; unit: string; qty: number }>();
  for (const r of rows) {
    const key = `${r.label.toLowerCase()}__${r.unit}`;
    const cur = byKey.get(key);
    if (cur) cur.qty += Number(r.quantity) || 0;
    else byKey.set(key, { label: r.label, unit: r.unit, qty: Number(r.quantity) || 0 });
  }
  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export default function EventDetail() {
  const { id } = useParams();
  const eventId = id as string;

  const [tab, setTab] = useState<"eat" | "bring" | "shop">("eat");
  const [me, setMe] = useState<string | null>(null);

  const [ev, setEv] = useState<EventRow | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [eat, setEat] = useState<EatRow[]>([]);
  const [bring, setBring] = useState<BringRow[]>([]);
  const [remain, setRemain] = useState<RemainingRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Form states
  const [eatSel, setEatSel] = useState<string>(""); // catalog id
  const [eatQty, setEatQty] = useState<number>(1);

  const [bringSel, setBringSel] = useState<string>(""); // catalog id ou ""
  const [bringLabel, setBringLabel] = useState<string>(""); // pour ajout libre
  const [bringUnit, setBringUnit] = useState<string>("pièce");
  const [bringQty, setBringQty] = useState<number>(1);

  const [shopLabel, setShopLabel] = useState<string>("");
  const [shopUnit, setShopUnit] = useState<string>("pièce");
  const [shopQty, setShopQty] = useState<number>(1);

  // --- LOAD ---
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id || null);

      // Event (ajout de share_code)
      const { data: evData } = await supabase
        .from("events")
        .select("id,title,event_date,location,share_code")
        .eq("id", eventId)
        .single();
      setEv(evData as EventRow | null);

      // Catalog
      const { data: cat } = await supabase
        .from("catalog_items")
        .select("id,label,category,unit")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("label", { ascending: true });
      setCatalog(cat || []);

      // Lists
      await reloadLists();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function reloadLists() {
    setMsg(null);
    const [{ data: eatRows }, { data: bringRows }, { data: remRows }] = await Promise.all([
      supabase.from("eat_selections").select("*").eq("event_id", eventId),
      supabase.from("bring_items").select("*").eq("event_id", eventId),
      supabase.from("shopping_remaining").select("*").eq("event_id", eventId),
    ]);
    setEat((eatRows || []) as EatRow[]);
    setBring((bringRows || []) as BringRow[]);
    setRemain((remRows || []) as RemainingRow[]);
  }

  // Derived totals
  const myEat = useMemo(() => eat.filter((e) => e.user_id === me), [eat, me]);
  const allEatTotals = useMemo(() => groupTotals(eat), [eat]);

  const myBring = useMemo(() => bring.filter((b) => b.user_id === me), [bring, me]);
  const allBringTotals = useMemo(() => groupTotals(bring), [bring]);

  // --- ACTIONS ---
  async function addEat(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !eatSel || eatQty <= 0) return;
    const item = catalog.find((c) => c.id === eatSel);
    if (!item) return;
    const { error } = await supabase.from("eat_selections").insert({
      event_id: eventId,
      user_id: me,
      label: item.label,
      category: item.category,
      unit: item.unit,
      quantity: eatQty,
      catalog_item_id: item.id,
    });
    if (error) setMsg("Erreur (eat): " + error.message);
    else {
      setEatQty(1);
      await reloadLists();
    }
  }

  async function removeEat(id: string) {
    const { error } = await supabase.from("eat_selections").delete().eq("id", id);
    if (error) setMsg("Suppression impossible: " + error.message);
    else await reloadLists();
  }

  async function addBring(e: React.FormEvent) {
    e.preventDefault();
    if (!me || bringQty <= 0) return;
    let label = bringLabel.trim();
    let unit = bringUnit;
    let category: string | null = null;
    let catalogId: string | null = null;

    if (bringSel) {
      const item = catalog.find((c) => c.id === bringSel);
      if (!item) return;
      label = item.label;
      unit = item.unit;
      category = item.category;
      catalogId = item.id;
    }
    if (!label) return;

    const { error } = await supabase.from("bring_items").insert({
      event_id: eventId,
      user_id: me,
      label,
      unit,
      category,
      quantity: bringQty,
      catalog_item_id: catalogId,
    });
    if (error) setMsg("Erreur (bring): " + error.message);
    else {
      setBringQty(1);
      setBringSel("");
      setBringLabel("");
      await reloadLists();
    }
  }

  async function removeBring(id: string) {
    const { error } = await supabase.from("bring_items").delete().eq("id", id);
    if (error) setMsg("Suppression impossible: " + error.message);
    else await reloadLists();
  }

  async function addShopAddition(e: React.FormEvent) {
    e.preventDefault();
    if (!shopLabel.trim() || shopQty <= 0) return;
    const { error } = await supabase.from("shopping_additions").insert({
      event_id: eventId,
      label: shopLabel.trim(),
      unit: shopUnit,
      quantity: shopQty,
    });
    if (error) setMsg("Erreur ajout course: " + error.message);
    else {
      setShopLabel("");
      setShopQty(1);
      await reloadLists();
    }
  }

  // Prefill "Je ramène" depuis la liste des restants
  function takeFromRemaining(r: RemainingRow) {
    setTab("bring");
    setBringSel(""); // ajout libre
    setBringLabel(r.label);
    setBringUnit(r.unit);
    setBringQty(r.remaining);
  }

  // UI helpers
  function CatalogSelect({
    value,
    onChange,
    placeholder = "Choisir dans la liste…",
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) {
    // groupe par catégorie
    const groups = useMemo(() => {
      const map = new Map<string, CatalogItem[]>();
      for (const c of catalog) {
        if (!map.has(c.category)) map.set(c.category, []);
        map.get(c.category)!.push(c);
      }
      return Array.from(map.entries());
    }, [catalog]);

    return (
      <select className="card px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {groups.map(([cat, items]) => (
          <optgroup label={cat} key={cat}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} ({i.unit})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{ev?.title ?? "Événement"}</h2>
          <div className="text-sm text-cheepo-text2">
            {ev?.location ? ev.location + " · " : ""}
            {ev?.event_date ? new Date(ev.event_date).toLocaleDateString() : "date à définir"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ev?.share_code && (
            <button
              className="btn card"
              onClick={async () => {
                const url = `${window.location.origin}/join/${ev.share_code}`;
                await navigator.clipboard.writeText(url);
                setMsg("Lien d’invitation copié 📋");
                setTimeout(() => setMsg(null), 1200);
              }}
            >
              Partager
            </button>
          )}
          <Link to="/events" className="underline text-cheepo-link">← Mes événements</Link>
        </div>
      </header>

      {msg && <div className="card p-3">{msg}</div>}

      {/* Onglets */}
      <div className="flex gap-2">
        <button className={`btn ${tab === "eat" ? "btn-primary" : "card"}`} onClick={() => setTab("eat")}>Qui mange quoi</button>
        <button className={`btn ${tab === "bring" ? "btn-primary" : "card"}`} onClick={() => setTab("bring")}>Qui apporte quoi</button>
        <button className={`btn ${tab === "shop" ? "btn-primary" : "card"}`} onClick={() => setTab("shop")}>Courses</button>
      </div>

      {/* --- TAB EAT --- */}
      {tab === "eat" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-3">
            <h3 className="font-semibold">Mes choix</h3>
            <form className="flex flex-wrap gap-2 items-center" onSubmit={addEat}>
              <CatalogSelect value={eatSel} onChange={setEatSel} />
              <input
                type="number" min={0.1} step={0.1}
                className="card px-3 py-2 w-24"
                value={eatQty}
                onChange={(e) => setEatQty(Number(e.target.value))}
              />
              <button className="btn btn-primary" type="submit">Ajouter</button>
            </form>

            <ul className="space-y-2">
              {myEat.length === 0 && <li className="text-cheepo-text2 text-sm">Aucun pour l’instant.</li>}
              {myEat.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>{r.label} — <span className="text-cheepo-text2">{r.quantity} {r.unit}</span></span>
                  <button className="btn card" onClick={() => removeEat(r.id)}>Supprimer</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-2">Total prévu (tous participants)</h3>
            <ul className="space-y-1">
              {allEatTotals.length === 0 && <li className="text-cheepo-text2 text-sm">Rien pour l’instant.</li>}
              {allEatTotals.map((t) => (
                <li key={`${t.label}-${t.unit}`}>{t.label} — <span className="text-cheepo-text2">{t.qty} {t.unit}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* --- TAB BRING --- */}
      {tab === "bring" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-3">
            <h3 className="font-semibold">Je ramène</h3>
            <form className="flex flex-wrap gap-2 items-center" onSubmit={addBring}>
              <CatalogSelect value={bringSel} onChange={(v) => { setBringSel(v); if (v) { setBringLabel(""); } }} placeholder="Choisir (ou laisse vide pour libre)"/>
              <span className="text-sm text-cheepo-text2">ou</span>
              <input
                className="card px-3 py-2"
                placeholder="Ajout libre (ex: chips)"
                value={bringLabel}
                onChange={(e) => { setBringLabel(e.target.value); if (e.target.value) setBringSel(""); }}
              />
              <input
                className="card px-3 py-2 w-28"
                placeholder="unité"
                value={bringUnit}
                onChange={(e) => setBringUnit(e.target.value)}
                disabled={!!bringSel}
              />
              <input
                type="number" min={0.1} step={0.1}
                className="card px-3 py-2 w-24"
                value={bringQty}
                onChange={(e) => setBringQty(Number(e.target.value))}
              />
              <button className="btn btn-primary" type="submit">Ajouter</button>
            </form>

            <ul className="space-y-2">
              {myBring.length === 0 && <li className="text-cheepo-text2 text-sm">Rien pour l’instant.</li>}
              {myBring.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>{r.label} — <span className="text-cheepo-text2">{r.quantity} {r.unit}</span></span>
                  <button className="btn card" onClick={() => removeBring(r.id)}>Supprimer</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-2">Tout ce qui est prévu d’être apporté</h3>
            <ul className="space-y-1">
              {allBringTotals.length === 0 && <li className="text-cheepo-text2 text-sm">Rien pour l’instant.</li>}
              {allBringTotals.map((t) => (
                <li key={`${t.label}-${t.unit}`}>{t.label} — <span className="text-cheepo-text2">{t.qty} {t.unit}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* --- TAB SHOP --- */}
      {tab === "shop" && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-2">Reste à acheter (auto)</h3>
            <ul className="space-y-2">
              {remain.length === 0 && <li className="text-cheepo-text2 text-sm">Rien à acheter pour l’instant.</li>}
              {remain.map((r) => (
                <li key={`${r.label}-${r.unit}`} className="flex items-center justify-between">
                  <span>{r.label} — <span className="text-cheepo-text2">{r.remaining} {r.unit}</span></span>
                  <button className="btn card" onClick={() => takeFromRemaining(r)}>Je ramène</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6 space-y-3">
            <h3 className="font-semibold">Ajouter un article à la liste de courses</h3>
            <form className="flex flex-wrap gap-2 items-center" onSubmit={addShopAddition}>
              <input className="card px-3 py-2" placeholder="Article (ex: glaçons)" value={shopLabel} onChange={(e)=>setShopLabel(e.target.value)} />
              <input className="card px-3 py-2 w-28" placeholder="unité" value={shopUnit} onChange={(e)=>setShopUnit(e.target.value)} />
              <input type="number" min={0.1} step={0.1} className="card px-3 py-2 w-24" value={shopQty} onChange={(e)=>setShopQty(Number(e.target.value))} />
              <button className="btn btn-primary" type="submit">Ajouter</button>
            </form>
            <p className="text-sm text-cheepo-text2">Ces ajouts <strong>n’affectent pas</strong> le catalogue global.</p>
          </div>
        </div>
      )}
    </div>
  );
}
