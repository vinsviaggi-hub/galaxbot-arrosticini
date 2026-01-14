"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./pannello.module.css";

type Booking = {
  nome: string;
  telefono: string;
  tipo: string;
  dataISO: string;
  ora: string;
  s50: number;
  s100: number;
  s200: number;
  tot: number;
  indirizzo: string;
  stato: string;
  note: string;
  timestampISO: string;
};

type StatusFilter = "TUTTE" | "NUOVA" | "CONFERMATA" | "CONSEGNATA" | "ANNULLATA";
type ViewMode = "AUTO" | "TABELLA" | "CARD";

type SettingsResponse =
  | { ok: true; bookings_open: boolean }
  | { ok: false; error?: string; details?: any };

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Risposta non valida dal server.", details: text };
  }
}

function toStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}
function toInt(v: any) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}
function normalizePhone(raw: string) {
  return (raw || "").replace(/[^\d+]/g, "");
}
function formatDateIT(iso: string) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function isoFromAnyDate(value: any): string {
  const s = toStr(value).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function badgeClass(stato: string) {
  const up = (stato || "").toUpperCase();
  if (up === "CONFERMATA") return `${styles.badge} ${styles.badgeGreen}`;
  if (up === "CONSEGNATA") return `${styles.badge} ${styles.badgeYellow}`;
  if (up === "ANNULLATA") return `${styles.badge} ${styles.badgeRed}`;
  if (up === "CONSEGNA") return `${styles.badge} ${styles.badgePurple}`;
  if (up === "RITIRO") return `${styles.badge} ${styles.badgeGray}`;
  return `${styles.badge} ${styles.badgeBlue}`; // NUOVA
}

function playBeepSafe() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.1;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    window.setTimeout(() => {
      try {
        o.stop();
        ctx.close?.();
      } catch {}
    }, 140);
  } catch {}
}

function makeBookingId(b: Booking) {
  const base = b.timestampISO?.trim();
  if (base) return base;
  return `${b.telefono}|${b.dataISO}|${b.ora}|${b.tipo}|${b.tot}`;
}

function waTextConfirm(b: Booking) {
  return `Ciao ${b.nome}, ✅ la tua prenotazione del ${formatDateIT(b.dataISO)} alle ${b.ora} è CONFERMATA. Grazie!`;
}
function waTextCancel(b: Booking) {
  return `Ciao ${b.nome}, ❌ la tua prenotazione del ${formatDateIT(b.dataISO)} alle ${b.ora} è stata ANNULLATA. Se vuoi riprenotare scrivici qui.`;
}
function openWA(phoneRaw: string, text: string) {
  const phone = normalizePhone(phoneRaw).replace("+", "");
  if (!phone) return;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function PannelloPrenotazioniPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<Booking[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("TUTTE");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [soundOn, setSoundOn] = useState(true);

  // ✅ Vista: AUTO / TABELLA / CARD
  const [viewMode, setViewMode] = useState<ViewMode>("AUTO");

  // ✅ AUTO “vero”: CARD solo su telefono, TABella su tablet/desktop
  const [autoCards, setAutoCards] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setAutoCards(mq.matches);
    sync();
    try {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    } catch {
      mq.addListener(sync);
      return () => mq.removeListener(sync);
    }
  }, []);

  // ✅ Prenotazioni aperte/chiuse (stato pubblico)
  const [bookingsOpen, setBookingsOpen] = useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const loadSettings = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setSettingsLoading(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data: SettingsResponse = await safeJson(res);
      if (!(data as any)?.ok) {
        setBookingsOpen(null);
        return;
      }
      setBookingsOpen(Boolean((data as any).bookings_open));
    } catch {
      setBookingsOpen(null);
    } finally {
      if (!opts?.silent) setSettingsLoading(false);
    }
  };

  const setBookingsOpenRemote = async (open: boolean) => {
    // prova prima admin endpoint (protetto da cookie admin)
    const body = JSON.stringify({ action: "set_bookings_open", bookings_open: open });
    let lastErr = "";

    const tryPost = async (url: string) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body,
      });
      const d: any = await safeJson(r);
      if (!r.ok || !d?.ok) {
        const msg = d?.error || `Errore impostando prenotazioni su ${url}`;
        throw new Error(msg);
      }
      return d;
    };

    try {
      await tryPost("/api/admin/settings");
      return;
    } catch (e: any) {
      lastErr = e?.message || "Errore";
    }

    // fallback: se usi lo stesso endpoint /api/settings anche in POST
    try {
      await tryPost("/api/settings");
      return;
    } catch (e: any) {
      lastErr = e?.message || lastErr || "Errore";
    }

    throw new Error(lastErr || "Impossibile aggiornare lo stato prenotazioni.");
  };

  const toggleBookings = async () => {
    const next = !(bookingsOpen ?? true);
    const ok = window.confirm(
      next ? "Vuoi APRIRE le prenotazioni nell'app?" : "Vuoi CHIUDERE le prenotazioni nell'app?"
    );
    if (!ok) return;

    setSettingsBusy(true);
    setErr("");
    try {
      // ottimismo UI
      setBookingsOpen(next);
      await setBookingsOpenRemote(next);
      await loadSettings({ silent: true });
    } catch (e: any) {
      await loadSettings({ silent: true });
      setErr(e?.message || "Errore aggiornando prenotazioni.");
    } finally {
      setSettingsBusy(false);
    }
  };

  useEffect(() => {
    void loadSettings({ silent: true });
    const id = window.setInterval(() => void loadSettings({ silent: true }), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // evidenziazione oro solo per nuove arrivate mentre il pannello è aperto
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadDoneRef = useRef(false);
  const [goldIds, setGoldIds] = useState<Set<string>>(new Set());

  const [busyId, setBusyId] = useState<string>("");

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("galax_admin_sound");
      if (s !== null) setSoundOn(s === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("galax_admin_sound", soundOn ? "1" : "0");
    } catch {}
  }, [soundOn]);

  // ✅ carica/salva vista
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("galax_admin_view_mode");
      if (v === "AUTO" || v === "TABELLA" || v === "CARD") setViewMode(v);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("galax_admin_view_mode", viewMode);
    } catch {}
  }, [viewMode]);

  const cycleViewMode = () => {
    setViewMode((v) => (v === "AUTO" ? "TABELLA" : v === "TABELLA" ? "CARD" : "AUTO"));
  };

  const maybeNotifyNewRows = (list: Booking[]) => {
    if (!firstLoadDoneRef.current) {
      firstLoadDoneRef.current = true;
      seenRef.current = new Set(list.map(makeBookingId));
      return;
    }

    const seen = seenRef.current;
    const newOnes = list.filter((b) => !seen.has(makeBookingId(b)));
    for (const b of list) seen.add(makeBookingId(b));

    if (newOnes.length === 0) return;
    if (document.hidden) return;

    const ids = newOnes
      .filter((b) => (b.stato || "").toUpperCase() === "NUOVA")
      .map((b) => makeBookingId(b));

    if (ids.length) {
      setGoldIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    }

    if (soundOn) playBeepSafe();
  };

  const cleanGoldIfNotNuova = (list: Booking[]) => {
    setGoldIds((prev) => {
      const next = new Set(prev);
      for (const id of Array.from(next)) {
        const found = list.find((x) => makeBookingId(x) === id);
        if (!found) next.delete(id);
        else if ((found.stato || "").toUpperCase() !== "NUOVA") next.delete(id);
      }
      return next;
    });
  };

  async function load(silent = false) {
    if (!silent) {
      setLoading(true);
      setErr("");
    } else {
      setErr("");
    }

    try {
      const r = await fetch("/api/admin/bookings", { method: "GET", cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/pannello/login";
        return;
      }
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setErr(data?.error || "Errore caricando prenotazioni.");
        setRows([]);
        return;
      }

      const list: any[] = Array.isArray(data.rows) ? data.rows : [];

      const parsed: Booking[] = list.map((item: any) => {
        const isArr = Array.isArray(item);
        const get = (i: number, k: string) => (isArr ? item[i] : item?.[k]);

        const dataISO = isoFromAnyDate(get(3, "Data") ?? get(3, "data") ?? get(3, "date"));

        const tsISO = (() => {
          const v = get(12, "Timestamp") ?? get(12, "timestamp");
          const s = toStr(v).trim();
          const d = new Date(s);
          if (s && Number.isFinite(d.getTime())) return d.toISOString();
          return s || "";
        })();

        return {
          nome: toStr(get(0, "Nome") ?? get(0, "nome")).trim(),
          telefono: toStr(get(1, "Telefono") ?? get(1, "telefono")).trim(),
          tipo: toStr(get(2, "Ritiro/Consegna") ?? get(2, "tipo")).trim().toUpperCase(),
          dataISO,
          ora: toStr(get(4, "Ora") ?? get(4, "ora")).trim(),
          s50: toInt(get(5, "Scatola 50") ?? get(5, "scatola50")),
          s100: toInt(get(6, "Scatola 100") ?? get(6, "scatola100")),
          s200: toInt(get(7, "Scatola 200") ?? get(7, "scatola200")),
          tot: toInt(get(8, "Totale Arrosticini") ?? get(8, "totaleArrosticini") ?? get(8, "tot")),
          indirizzo: toStr(get(9, "Indirizzo") ?? get(9, "indirizzo")).trim(),
          stato: toStr(get(10, "Stato") ?? get(10, "stato")).trim().toUpperCase() || "NUOVA",
          note: toStr(get(11, "Note") ?? get(11, "note")).trim(),
          timestampISO: tsISO,
        };
      });

      parsed.sort((a, b) => {
        const da = `${a.dataISO} ${a.ora}`.trim();
        const db = `${b.dataISO} ${b.ora}`.trim();
        if (da < db) return -1;
        if (da > db) return 1;
        return (a.timestampISO || "").localeCompare(b.timestampISO || "");
      });

      maybeNotifyNewRows(parsed);
      cleanGoldIfNotNuova(parsed);
      setRows(parsed);
    } catch (e: any) {
      setErr(e?.message || "Errore rete.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/pannello/login";
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh più veloce + refresh al ritorno dal tab WhatsApp
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) void load(true);
    };
    document.addEventListener("visibilitychange", onVis);

    const id = window.setInterval(() => {
      if (document.hidden) return;
      void load(true);
    }, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "TUTTE" && r.stato !== status) return false;
      if (from && r.dataISO && r.dataISO < from) return false;
      if (to && r.dataISO && r.dataISO > to) return false;
      if (!qq) return true;
      const blob = [r.nome, r.telefono, r.tipo, r.dataISO, r.ora, r.stato, r.indirizzo, r.note].join(" ").toLowerCase();
      return blob.includes(qq);
    });
  }, [rows, q, status, from, to]);

  const counts = useMemo(() => {
    const c = { NUOVA: 0, CONFERMATA: 0, CONSEGNATA: 0, ANNULLATA: 0, TUTTE: rows.length };
    for (const r of rows) {
      const s = (r.stato || "NUOVA").toUpperCase();
      if (s === "NUOVA") c.NUOVA++;
      else if (s === "CONFERMATA") c.CONFERMATA++;
      else if (s === "CONSEGNATA") c.CONSEGNATA++;
      else if (s === "ANNULLATA") c.ANNULLATA++;
    }
    return c;
  }, [rows]);

  // ✅ ora supporta anche CONSEGNATA
  async function updateStatus(b: Booking, newStatus: "CONFERMATA" | "CONSEGNATA" | "ANNULLATA") {
    const id = makeBookingId(b);
    if (!id) return;

    // WhatsApp: SOLO conferma/annulla (consegnata di solito no)
    if (newStatus === "CONFERMATA") openWA(b.telefono, waTextConfirm(b));
    if (newStatus === "ANNULLATA") openWA(b.telefono, waTextCancel(b));

    // UI subito
    const prev = b.stato;
    setRows((old) => old.map((x) => (makeBookingId(x) === id ? { ...x, stato: newStatus } : x)));
    setGoldIds((old) => {
      const next = new Set(old);
      next.delete(id);
      return next;
    });

    // salva
    setBusyId(id);
    setErr("");

    try {
      const r = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "updateStatus",
          stato: newStatus,
          timestampISO: b.timestampISO,
          telefono: b.telefono,
          dataISO: b.dataISO,
          ora: b.ora,
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setRows((old) => old.map((x) => (makeBookingId(x) === id ? { ...x, stato: prev } : x)));
        setErr(data?.error || "Errore aggiornando lo stato.");
        return;
      }
      void load(true);
    } catch (e: any) {
      setRows((old) => old.map((x) => (makeBookingId(x) === id ? { ...x, stato: prev } : x)));
      setErr(e?.message || "Errore rete aggiornando lo stato.");
    } finally {
      setBusyId("");
    }
  }

  const forceTable = viewMode === "TABELLA";
  const forceCards = viewMode === "CARD";

  const showTable = forceTable || (viewMode === "AUTO" && !autoCards && !forceCards);
  const showCards = forceCards || (viewMode === "AUTO" && autoCards && !forceTable);

  const consegnataBtnStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(255, 210, 77, 0.92), rgba(255, 170, 0, 0.85))",
    color: "#1b1400",
    border: "1px solid rgba(15, 23, 42, 0.16)",
    fontWeight: 900,
  };

  const bookingsLabel = bookingsOpen === null ? "—" : bookingsOpen ? "APERTE" : "CHIUSE";

  return (
    <div className={`${styles.page} ar-panel`}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <div className={`${styles.topRow} ar-topRow`}>
              <div className={styles.titleWrap}>
                <div className={styles.logo} aria-hidden>
                  📅
                </div>
                <div>
                  <h1 className={styles.h1}>Prenotazioni laboratorio arrosticini</h1>
                </div>
              </div>

              <div className={`${styles.headerActions} ar-actions`}>
                {/* ✅ Stato prenotazioni (app pubblica) */}
                <span
                  className={styles.soundChip}
                  title="Stato prenotazioni (app)"
                  style={{
                    border:
                      bookingsOpen === null
                        ? "1px solid rgba(15,23,42,0.14)"
                        : bookingsOpen
                        ? "1px solid rgba(22,163,74,0.35)"
                        : "1px solid rgba(220,38,38,0.35)",
                    background:
                      bookingsOpen === null
                        ? "rgba(255,255,255,0.86)"
                        : bookingsOpen
                        ? "rgba(22,163,74,0.10)"
                        : "rgba(220,38,38,0.08)",
                  }}
                >
                  {settingsLoading ? "⏳" : bookingsOpen ? "✅" : bookingsOpen === false ? "⛔️" : "ℹ️"} Prenotazioni:{" "}
                  <b>{bookingsLabel}</b>
                </span>

                <button
                  className={styles.btn}
                  type="button"
                  onClick={toggleBookings}
                  disabled={settingsBusy}
                  title="Apri/chiudi prenotazioni nell'app"
                  style={{
                    borderColor: bookingsOpen ? "rgba(220,38,38,0.35)" : "rgba(22,163,74,0.35)",
                    background: bookingsOpen ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.10)",
                  }}
                >
                  {settingsBusy ? "…" : bookingsOpen ? "⛔️ Chiudi prenotazioni" : "✅ Apri prenotazioni"}
                </button>

                <button className={styles.btn} type="button" onClick={cycleViewMode} title="Cambia vista">
                  🪟 Vista: <b>{viewMode}</b>
                </button>

                <button
                  className={styles.soundChip}
                  onClick={() => {
                    if (!soundOn) playBeepSafe();
                    setSoundOn((v) => !v);
                  }}
                  type="button"
                >
                  🔔 Suono: <b>{soundOn ? "ON" : "OFF"}</b>
                </button>

                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => load(false)} disabled={loading}>
                  {loading ? "Aggiorno…" : "Aggiorna"}
                </button>
                <button className={styles.btn} onClick={logout}>
                  Logout
                </button>
              </div>
            </div>

            <div className={styles.statusBar}>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Stati</p>

                <div className={`${styles.pills} ar-pills`}>
                  <button
                    className={`${styles.pill} ${status === "NUOVA" ? styles.pillActive : ""}`}
                    onClick={() => setStatus("NUOVA")}
                    type="button"
                  >
                    <span className={`${styles.dot} ${styles.dotNew}`} />
                    NUOVA <b>({counts.NUOVA})</b>
                  </button>
                  <button
                    className={`${styles.pill} ${status === "CONFERMATA" ? styles.pillActive : ""}`}
                    onClick={() => setStatus("CONFERMATA")}
                    type="button"
                  >
                    <span className={`${styles.dot} ${styles.dotConf}`} />
                    CONFERMATA <b>({counts.CONFERMATA})</b>
                  </button>
                  <button
                    className={`${styles.pill} ${status === "CONSEGNATA" ? styles.pillActive : ""}`}
                    onClick={() => setStatus("CONSEGNATA")}
                    type="button"
                  >
                    <span className={`${styles.dot} ${styles.dotCons}`} />
                    CONSEGNATA <b>({counts.CONSEGNATA})</b>
                  </button>
                  <button
                    className={`${styles.pill} ${status === "ANNULLATA" ? styles.pillActive : ""}`}
                    onClick={() => setStatus("ANNULLATA")}
                    type="button"
                  >
                    <span className={`${styles.dot} ${styles.dotAnn}`} />
                    ANNULLATA <b>({counts.ANNULLATA})</b>
                  </button>
                  <button
                    className={`${styles.pill} ${status === "TUTTE" ? styles.pillActive : ""}`}
                    onClick={() => setStatus("TUTTE")}
                    type="button"
                  >
                    <span className={`${styles.dot} ${styles.dotAll}`} />
                    TUTTE <b>({counts.TUTTE})</b>
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.tools}>
              <div className={styles.search}>
                <input
                  className={styles.input}
                  placeholder="Cerca: nome, telefono, data, stato, note..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className={styles.range}>
                <span className={styles.smallLabel}>Da</span>
                <input className={styles.dateInput} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className={styles.smallLabel}>A</span>
                <input className={styles.dateInput} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>

              <button
                className={styles.btn}
                type="button"
                onClick={() => {
                  setQ("");
                  setFrom("");
                  setTo("");
                  setStatus("TUTTE");
                }}
              >
                Reset
              </button>

              <div className={styles.smallCount}>
                {filtered.length}/{rows.length}
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className={styles.alert}>
            ⚠️ <b>{err}</b>
          </div>
        ) : null}

        {/* TABELLA */}
        <div className={styles.tableWrap} aria-busy={loading ? "true" : "false"} style={!showTable ? { display: "none" } : undefined}>
          <div className="ar-tableX">
            <table className={`${styles.table} ar-table`}>
              <thead>
                <tr>
                  <th className={styles.th}>Data</th>
                  <th className={styles.th}>Ora</th>
                  <th className={styles.th}>Cliente</th>
                  <th className={styles.th}>Telefono</th>
                  <th className={styles.th}>Tipo</th>
                  <th className={styles.th}>Scatole 50pz</th>
                  <th className={styles.th}>Scatole 100pz</th>
                  <th className={styles.th}>Scatole 200pz</th>
                  <th className={styles.th}>Tot pezzi</th>
                  <th className={styles.th}>Stato</th>
                  <th className={styles.th}>Indirizzo</th>
                  <th className={styles.th}>Note</th>
                  <th className={styles.th}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr className={styles.row}>
                    <td className={styles.td} colSpan={13}>
                      Caricamento…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr className={styles.row}>
                    <td className={styles.td} colSpan={13}>
                      Nessun risultato.
                    </td>
                  </tr>
                ) : (
                  filtered.map((b, idx) => {
                    const id = makeBookingId(b);
                    const isGold = goldIds.has(id);
                    const isBusy = busyId === id;

                    const phone = normalizePhone(b.telefono);
                    const telHref = phone ? `tel:${phone}` : undefined;
                    const mapHref =
                      b.indirizzo && b.tipo === "CONSEGNA"
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.indirizzo)}`
                        : undefined;

                    const statoUp = (b.stato || "").toUpperCase();

                    return (
                      <tr key={`${id}-${idx}`} className={`${styles.row} ${isGold ? styles.rowGold : ""}`}>
                        <td className={`${styles.td} ${styles.mono}`}>{formatDateIT(b.dataISO)}</td>
                        <td className={`${styles.td} ${styles.mono}`}>{b.ora}</td>
                        <td className={styles.tdName}>{b.nome}</td>
                        <td className={`${styles.td} ${styles.mono}`}>{b.telefono}</td>
                        <td className={styles.td}>
                          <span className={badgeClass(b.tipo === "CONSEGNA" ? "CONSEGNA" : "RITIRO")}>{b.tipo}</span>
                        </td>
                        <td className={`${styles.td} ${styles.mono}`}>{b.s50}</td>
                        <td className={`${styles.td} ${styles.mono}`}>{b.s100}</td>
                        <td className={`${styles.td} ${styles.mono}`}>{b.s200}</td>
                        <td className={`${styles.td} ${styles.mono} ${styles.tdTot}`}>{b.tot}</td>
                        <td className={styles.td}>
                          <span className={badgeClass(b.stato)}>{b.stato}</span>
                        </td>
                        <td className={`${styles.tdWrap} ar-wrap`}>{b.indirizzo || "—"}</td>
                        <td className={`${styles.tdWrap} ar-wrap`}>{b.note || "—"}</td>
                        <td className={styles.td}>
                          <div className={styles.actions}>
                            {telHref ? (
                              <a className={`${styles.actionBtn} ${styles.actionCall}`} href={telHref}>
                                📞 Chiama
                              </a>
                            ) : null}

                            <button
                              className={`${styles.actionBtn} ${styles.actionOk}`}
                              type="button"
                              disabled={isBusy || statoUp !== "NUOVA"}
                              onClick={() => updateStatus(b, "CONFERMATA")}
                            >
                              ✅ Conferma
                            </button>

                            <button
                              className={`${styles.actionBtn} ar-actionDone`}
                              style={consegnataBtnStyle}
                              type="button"
                              disabled={isBusy || statoUp !== "CONFERMATA"}
                              onClick={() => updateStatus(b, "CONSEGNATA")}
                              title={statoUp !== "CONFERMATA" ? "Prima conferma, poi consegna" : "Segna come consegnata"}
                            >
                              📦 Consegnata
                            </button>

                            <button
                              className={`${styles.actionBtn} ${styles.actionNo}`}
                              type="button"
                              disabled={isBusy}
                              onClick={() => updateStatus(b, "ANNULLATA")}
                            >
                              ❌ Annulla
                            </button>

                            {mapHref ? (
                              <a className={`${styles.actionBtn} ${styles.actionMap}`} href={mapHref} target="_blank" rel="noreferrer">
                                📍 Maps
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARD */}
        <div className={styles.mobileCards} style={!showCards ? { display: "none" } : undefined}>
          {loading ? (
            <div className={styles.mCard}>Caricamento…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.mCard}>Nessun risultato.</div>
          ) : (
            filtered.map((b, idx) => {
              const id = makeBookingId(b);
              const isGold = goldIds.has(id);
              const isBusy = busyId === id;

              const phone = normalizePhone(b.telefono);
              const telHref = phone ? `tel:${phone}` : undefined;
              const mapHref =
                b.indirizzo && b.tipo === "CONSEGNA"
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.indirizzo)}`
                  : undefined;

              const statoUp = (b.stato || "").toUpperCase();

              return (
                <div key={`${id}-m-${idx}`} className={`${styles.mCard} ${isGold ? styles.mCardGold : ""}`}>
                  <div className={styles.mTop}>
                    <div>
                      <p className={styles.mName}>{b.nome}</p>
                      <p className={styles.mSub}>
                        <span className={styles.mPill}>
                          📅 {formatDateIT(b.dataISO)} • <b className={styles.mono}>{b.ora}</b>
                        </span>{" "}
                        <span className={styles.mPill}>
                          📞 <span className={styles.mono}>{b.telefono}</span>
                        </span>
                      </p>
                    </div>
                    <div className={styles.mBadges}>
                      <span className={badgeClass(b.stato)}>{b.stato}</span>
                      <span className={badgeClass(b.tipo === "CONSEGNA" ? "CONSEGNA" : "RITIRO")}>{b.tipo}</span>
                    </div>
                  </div>

                  <div className={styles.mGrid}>
                    <div className={styles.mBox}>
                      <p className={styles.mBoxLabel}>Scatole</p>
                      <p className={styles.mBoxValue}>
                        50: <b>{b.s50}</b> • 100: <b>{b.s100}</b> • 200: <b>{b.s200}</b>
                      </p>
                    </div>

                    <div className={styles.mBox}>
                      <p className={styles.mBoxLabel}>Totale</p>
                      <p className={`${styles.mBoxValue} ${styles.mTot}`}>{b.tot}</p>
                    </div>

                    <div className={styles.mBoxFull}>
                      <p className={styles.mBoxLabel}>Indirizzo</p>
                      <p className={styles.mBoxValue}>{b.indirizzo || "—"}</p>
                    </div>

                    <div className={styles.mBoxFull}>
                      <p className={styles.mBoxLabel}>Note</p>
                      <p className={styles.mBoxValue}>{b.note || "—"}</p>
                    </div>
                  </div>

                  <div className={styles.actionsMobile}>
                    {telHref ? (
                      <a className={`${styles.actionBtn} ${styles.actionCall}`} href={telHref}>
                        📞 Chiama
                      </a>
                    ) : null}

                    <button
                      className={`${styles.actionBtn} ${styles.actionOk}`}
                      type="button"
                      disabled={isBusy || statoUp !== "NUOVA"}
                      onClick={() => updateStatus(b, "CONFERMATA")}
                    >
                      ✅ Conferma
                    </button>

                    <button
                      className={`${styles.actionBtn} ar-actionDone`}
                      style={consegnataBtnStyle}
                      type="button"
                      disabled={isBusy || statoUp !== "CONFERMATA"}
                      onClick={() => updateStatus(b, "CONSEGNATA")}
                    >
                      📦 Consegnata
                    </button>

                    <button
                      className={`${styles.actionBtn} ${styles.actionNo}`}
                      type="button"
                      disabled={isBusy}
                      onClick={() => updateStatus(b, "ANNULLATA")}
                    >
                      ❌ Annulla
                    </button>

                    {mapHref ? (
                      <a className={`${styles.actionBtn} ${styles.actionMap}`} href={mapHref} target="_blank" rel="noreferrer">
                        📍 Maps
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.footer}>GalaxBot • Pannello prenotazioni</div>
      </div>

      {/* ✅ patch minima: table scroll + wrap pills su tablet */}
      <style>{`
        .ar-panel .ar-pills{ display:flex; flex-wrap:wrap; gap:8px; }
        .ar-panel .ar-actions{ flex-wrap:wrap; gap:10px; }
        .ar-panel .ar-tableX{ width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:6px; }
        .ar-panel .ar-table{ width:100%; min-width: 980px; }
        .ar-panel .ar-table th{ font-size: 12px; line-height: 1.15; white-space: nowrap; }
        .ar-panel .ar-table td{ font-size: 13px; line-height: 1.25; }
        .ar-panel .ar-wrap{ max-width: 320px; white-space: normal; word-break: break-word; }
      `}</style>
    </div>
  );
}