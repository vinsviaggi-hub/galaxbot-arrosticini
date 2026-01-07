"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./pannello.module.css";

type Booking = {
  nome: string;
  telefono: string;
  tipo: string; // RITIRO | CONSEGNA
  dataISO: string; // YYYY-MM-DD
  ora: string;
  s50: number;
  s100: number;
  s200: number;
  tot: number;
  indirizzo: string;
  stato: string; // NUOVA | CONFERMATA | CONSEGNATA | ANNULLATA | ...
  note: string;
  timestampISO: string;
};

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
  // iso: YYYY-MM-DD
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
  // Apps Script può restituire: "Tue Dec 30 2025 ..." oppure ISO
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
  if (up === "CONSEGNA" || up === "CONSEGNA " || up === "CONSEGNA") return `${styles.badge} ${styles.badgePurple}`;
  if (up === "RITIRO") return `${styles.badge} ${styles.badgeGray}`;
  return `${styles.badge} ${styles.badgeBlue}`; // NUOVA default
}

/** ✅ beep leggero e sicuro */
function playBeepSafe() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.12;
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
  // se timestampISO c'è, è perfetto
  const base = b.timestampISO?.trim();
  if (base) return base;
  // fallback stabile
  return `${b.telefono}|${b.dataISO}|${b.ora}|${b.tipo}|${b.tot}`;
}

export default function PannelloPrenotazioniPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<Booking[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"TUTTE" | "NUOVA" | "CONFERMATA" | "CONSEGNATA" | "ANNULLATA">("TUTTE");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // ✅ toggle suono
  const [soundOn, setSoundOn] = useState(true);

  // ✅ memoria per capire se arrivano nuove prenotazioni
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadDoneRef = useRef(false);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("arrost_admin_sound");
      if (s !== null) setSoundOn(s === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("arrost_admin_sound", soundOn ? "1" : "0");
    } catch {}
  }, [soundOn]);

  const maybeNotifyNewRows = (list: Booking[]) => {
    // prima volta: segna e non suonare
    if (!firstLoadDoneRef.current) {
      firstLoadDoneRef.current = true;
      seenRef.current = new Set(list.map(makeBookingId));
      return;
    }

    const seen = seenRef.current;
    const newOnes = list.filter((b) => !seen.has(makeBookingId(b)));

    // aggiorna set
    for (const b of list) seen.add(makeBookingId(b));

    if (newOnes.length === 0) return;
    if (document.hidden) return;

    if (soundOn) playBeepSafe();
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

      // data.rows può essere: array di array oppure array di oggetti
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
          tot: toInt(get(8, "Totale Arrosticini") ?? get(8, "totaleArrosticini")),
          indirizzo: toStr(get(9, "Indirizzo") ?? get(9, "indirizzo")).trim(),
          stato: toStr(get(10, "Stato") ?? get(10, "stato")).trim().toUpperCase() || "NUOVA",
          note: toStr(get(11, "Note") ?? get(11, "note")).trim(),
          timestampISO: tsISO,
        };
      });

      // Ordine (data, ora, timestamp)
      parsed.sort((a, b) => {
        const da = `${a.dataISO} ${a.ora}`.trim();
        const db = `${b.dataISO} ${b.ora}`.trim();
        if (da < db) return -1;
        if (da > db) return 1;
        return (a.timestampISO || "").localeCompare(b.timestampISO || "");
      });

      // ✅ suono nuove prenotazioni
      maybeNotifyNewRows(parsed);

      setRows(parsed);
    } catch (e: any) {
      setErr(e?.message || "Errore rete.");
      setRows([]);
    } finally {
      if (!silent) setLoading(false);
      else setLoading(false); // così non resta “true” dopo il primo load
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

  // ✅ polling soft: serve per far arrivare il beep
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void load(true);
    }, 60_000); // 60s
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (status !== "TUTTE" && r.stato !== status) return false;

      if (from && r.dataISO && r.dataISO < from) return false;
      if (to && r.dataISO && r.dataISO > to) return false;

      if (!qq) return true;
      const blob = [r.nome, r.telefono, r.tipo, r.dataISO, r.ora, r.stato, r.indirizzo, r.note]
        .join(" ")
        .toLowerCase();
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

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);
  const tomorrowISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const countToday = useMemo(() => rows.filter((r) => r.dataISO === todayISO).length, [rows, todayISO]);
  const countTomorrow = useMemo(() => rows.filter((r) => r.dataISO === tomorrowISO).length, [rows, tomorrowISO]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.topRow}>
              <div className={styles.titleWrap}>
                <div className={styles.logo} aria-hidden>
                  🥩
                </div>
                <div>
                  <h1 className={styles.h1}>Prenotazioni — Arrosticini</h1>
                  <p className={styles.subtitle}>Pannello admin (leggibile + mobile “wow”)</p>
                </div>
              </div>

              <div className={styles.headerActions}>
                <button
                  className={styles.soundChip}
                  onClick={() => {
                    if (!soundOn) {
                      try {
                        playBeepSafe();
                      } catch {}
                    }
                    setSoundOn((v) => !v);
                  }}
                  type="button"
                  title="Suono per nuove prenotazioni"
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

            <div className={styles.grid}>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Oggi</p>
                <p className={styles.metricValue}>{countToday}</p>
                <p className={styles.metricSub}>prenotazioni</p>
              </div>

              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Domani</p>
                <p className={styles.metricValue}>{countTomorrow}</p>
                <p className={styles.metricSub}>prenotazioni</p>
              </div>

              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Stati</p>
                <div className={styles.pills}>
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

        {/* DESKTOP TABLE */}
        <div className={styles.tableWrap} aria-busy={loading ? "true" : "false"}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Data</th>
                <th className={styles.th}>Ora</th>
                <th className={styles.th}>Nome</th>
                <th className={styles.th}>Telefono</th>
                <th className={styles.th}>Tipo</th>
                <th className={styles.th}>50</th>
                <th className={styles.th}>100</th>
                <th className={styles.th}>200</th>
                <th className={styles.th}>Tot</th>
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
                  const phone = normalizePhone(b.telefono);
                  const telHref = phone ? `tel:${phone}` : undefined;
                  const waHref = phone
                    ? `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(
                        `Ciao ${b.nome}, confermiamo la prenotazione del ${formatDateIT(b.dataISO)} alle ${b.ora}.`
                      )}`
                    : undefined;
                  const mapHref =
                    b.indirizzo && b.tipo === "CONSEGNA"
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.indirizzo)}`
                      : undefined;

                  return (
                    <tr key={`${makeBookingId(b)}-${idx}`} className={styles.row}>
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
                      <td className={styles.tdWrap}>{b.indirizzo || "—"}</td>
                      <td className={styles.tdWrap}>{b.note || "—"}</td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          {telHref ? (
                            <a className={`${styles.actionBtn} ${styles.actionCall}`} href={telHref}>
                              📞 Chiama
                            </a>
                          ) : null}
                          {waHref ? (
                            <a className={`${styles.actionBtn} ${styles.actionWa}`} href={waHref} target="_blank" rel="noreferrer">
                              💬 WhatsApp
                            </a>
                          ) : null}
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

        {/* MOBILE CARDS */}
        <div className={styles.mobileCards}>
          {loading ? (
            <div className={styles.mCard}>Caricamento…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.mCard}>Nessun risultato.</div>
          ) : (
            filtered.map((b, idx) => {
              const phone = normalizePhone(b.telefono);
              const telHref = phone ? `tel:${phone}` : undefined;
              const waHref = phone
                ? `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(
                    `Ciao ${b.nome}, confermiamo la prenotazione del ${formatDateIT(b.dataISO)} alle ${b.ora}.`
                  )}`
                : undefined;
              const mapHref =
                b.indirizzo && b.tipo === "CONSEGNA"
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.indirizzo)}`
                  : undefined;

              const isNew = (b.stato || "").toUpperCase() === "NUOVA";

              return (
                <div key={`${makeBookingId(b)}-m-${idx}`} className={`${styles.mCard} ${isNew ? styles.mCardNew : ""}`}>
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
                    {waHref ? (
                      <a className={`${styles.actionBtn} ${styles.actionWa}`} href={waHref} target="_blank" rel="noreferrer">
                        💬 WhatsApp
                      </a>
                    ) : null}
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

        <div className={styles.footer}>GalaxBot AI • Pannello prenotazioni</div>
      </div>
    </div>
  );
}