"use client";

import { useMemo, useState } from "react";

export type BookingRow = {
  nome: string;
  telefono: string;
  ritiroConsegna: string;
  data: string;
  ora: string;
  scatola50: number;
  scatola100: number;
  scatola200: number;
  totaleArrosticini: number;
  indirizzo: string;
  stato: string;
  note: string;
  timestamp: string;
};

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
    <div
      style={{
        background: "rgba(10,14,22,.92)",
        border: "1px solid rgba(255,255,255,.18)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca: nome, tel, data, stato…"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(255,255,255,.06)",
            color: "white",
            outline: "none",
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {filtered.length}/{rows.length}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.9 }}>
              {["Data", "Ora", "Nome", "Telefono", "Tipo", "50", "100", "200", "Tot", "Stato", "Indirizzo", "Note"].map((h) => (
                <th key={h} style={{ padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.timestamp + i} style={{ fontSize: 13 }}>
                <td style={td}>{r.data}</td>
                <td style={td}>{r.ora}</td>
                <td style={td}><b>{r.nome}</b></td>
                <td style={td}>{r.telefono}</td>
                <td style={td}>{r.ritiroConsegna}</td>
                <td style={td}>{r.scatola50}</td>
                <td style={td}>{r.scatola100}</td>
                <td style={td}>{r.scatola200}</td>
                <td style={td}><b>{r.totaleArrosticini}</b></td>
                <td style={td}>{r.stato}</td>
                <td style={td}>{r.indirizzo}</td>
                <td style={td}>{r.note}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={12} style={{ ...td, padding: 14, opacity: 0.75 }}>
                  Nessun risultato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  verticalAlign: "top",
};