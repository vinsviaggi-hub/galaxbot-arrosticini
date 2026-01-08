"use client";

import { useMemo, useState, type CSSProperties } from "react";
import styles from "../pannello.module.css";

export type BookingRow = {
  nome: string;
  telefono: string;
  ritiroConsegna: string; // RITIRO | CONSEGNA
  data: string; // YYYY-MM-DD (o già formattata)
  ora: string;
  scatola50: number;
  scatola100: number;
  scatola200: number;
  totaleArrosticini: number;
  indirizzo: string;
  stato: string; // NUOVA | CONFERMATA | CONSEGNATA | ANNULLATA
  note: string;
  timestamp: string;
};

function toStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function formatDateIT(value: string) {
  const s = toStr(value).trim();
  if (!s) return "";
  // se è ISO (YYYY-MM-DD) lo converto
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}

function badgeClass(kind: string) {
  const up = (kind || "").toUpperCase();

  // Stato
  if (up === "CONFERMATA") return `${styles.badge} ${styles.badgeGreen}`;
  if (up === "CONSEGNATA") return `${styles.badge} ${styles.badgeYellow}`;
  if (up === "ANNULLATA") return `${styles.badge} ${styles.badgeRed}`;
  if (up === "NUOVA") return `${styles.badge} ${styles.badgeBlue}`;

  // Tipo (ritiro/consegna)
  if (up === "CONSEGNA") return `${styles.badge} ${styles.badgePurple}`;
  if (up === "RITIRO") return `${styles.badge} ${styles.badgeGray}`;

  return `${styles.badge} ${styles.badgeGray}`;
}

export default function BookingsTable({ rows }: { rows: BookingRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) =>
      [
        r.nome,
        r.telefono,
        r.ritiroConsegna,
        r.data,
        r.ora,
        r.indirizzo,
        r.stato,
        r.note,
      ]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [q, rows]);

  return (
    <>
      {/* TOOLBAR */}
      <div className={styles.card}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className={styles.search} style={{ flex: 1, minWidth: 240 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca: nome, tel, data, stato…"
              className={styles.input}
            />
          </div>

          <span className={`${styles.badge} ${styles.badgeGray}`}>
            {filtered.length}/{rows.length}
          </span>
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <div className={styles.tableWrap} aria-busy={rows.length === 0 ? "false" : "false"}>
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
            </tr>
          </thead>

          <tbody>
            {filtered.length ? (
              filtered.map((r, i) => (
                <tr key={`${r.timestamp}-${i}`} className={styles.row}>
                  <td className={`${styles.td} ${styles.mono}`}>{formatDateIT(r.data)}</td>
                  <td className={`${styles.td} ${styles.mono}`}>{r.ora || "—"}</td>
                  <td className={styles.tdName}>{r.nome || "—"}</td>
                  <td className={`${styles.td} ${styles.mono}`}>{r.telefono || "—"}</td>
                  <td className={styles.td}>
                    <span className={badgeClass(r.ritiroConsegna)}>{(r.ritiroConsegna || "—").toUpperCase()}</span>
                  </td>
                  <td className={`${styles.td} ${styles.mono}`}>{r.scatola50 ?? 0}</td>
                  <td className={`${styles.td} ${styles.mono}`}>{r.scatola100 ?? 0}</td>
                  <td className={`${styles.td} ${styles.mono}`}>{r.scatola200 ?? 0}</td>
                  <td className={`${styles.td} ${styles.mono} ${styles.tdTot}`}>
                    <b>{r.totaleArrosticini ?? 0}</b>
                  </td>
                  <td className={styles.td}>
                    <span className={badgeClass(r.stato)}>{(r.stato || "NUOVA").toUpperCase()}</span>
                  </td>
                  <td className={styles.tdWrap}>{r.indirizzo || "—"}</td>
                  <td className={styles.tdWrap}>{r.note || "—"}</td>
                </tr>
              ))
            ) : (
              <tr className={styles.row}>
                <td className={styles.td} colSpan={12} style={{ padding: 14, opacity: 0.8 }}>
                  Nessun risultato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS */}
      <div className={styles.mobileCards}>
        {filtered.length ? (
          filtered.map((r, i) => (
            <div key={`${r.timestamp}-m-${i}`} className={styles.mCard}>
              <div className={styles.mTop}>
                <div>
                  <p className={styles.mName}>{r.nome || "—"}</p>
                  <p className={styles.mSub}>
                    {formatDateIT(r.data)} • <b className={styles.mono}>{r.ora || "—"}</b> •{" "}
                    <span className={styles.mono}>{r.telefono || "—"}</span>
                  </p>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <span className={badgeClass(r.stato)}>{(r.stato || "NUOVA").toUpperCase()}</span>
                  <span className={badgeClass(r.ritiroConsegna)}>{(r.ritiroConsegna || "—").toUpperCase()}</span>
                </div>
              </div>

              <div className={styles.mGrid}>
                <div className={styles.mBox}>
                  <p className={styles.mBoxLabel}>Scatole</p>
                  <p className={styles.mBoxValue}>
                    50: {r.scatola50 ?? 0} • 100: {r.scatola100 ?? 0} • 200: {r.scatola200 ?? 0}
                  </p>
                </div>

                <div className={styles.mBox}>
                  <p className={styles.mBoxLabel}>Totale</p>
                  <p className={styles.mBoxValue}>
                    <b>{r.totaleArrosticini ?? 0}</b>
                  </p>
                </div>

                <div className={styles.mBox} style={mFull}>
                  <p className={styles.mBoxLabel}>Indirizzo</p>
                  <p className={styles.mBoxValue}>{r.indirizzo || "—"}</p>
                </div>

                <div className={styles.mBox} style={mFull}>
                  <p className={styles.mBoxLabel}>Note</p>
                  <p className={styles.mBoxValue}>{r.note || "—"}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.mCard} style={{ opacity: 0.85 }}>
            Nessun risultato.
          </div>
        )}
      </div>
    </>
  );
}

const mFull: CSSProperties = { gridColumn: "1 / -1" };