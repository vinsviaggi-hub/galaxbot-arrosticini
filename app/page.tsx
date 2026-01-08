"use client";

import React, { useMemo, useRef, useState, type FormEvent } from "react";
import ChatBox from "./components/chatbox";

type Fulfillment = "RITIRO" | "CONSEGNA";

const BRAND_NAME = "Arrosticini Abruzzesi";
// ✅ tolto “Prenota in 20 secondi…”
const TAGLINE = "Scatole da 50 / 100 / 200";
const DEFAULT_STATUS = "NUOVA";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function buildSlots(startHH: number, startMM: number, endHH: number, endMM: number, stepMin = 15) {
  const out: string[] = [];
  let t = startHH * 60 + startMM;
  const end = endHH * 60 + endMM;
  while (t <= end) {
    const hh = Math.floor(t / 60);
    const mm = t % 60;
    out.push(`${pad2(hh)}:${pad2(mm)}`);
    t += stepMin;
  }
  return out;
}

export default function Page() {
  // ✅ chat nascosta finché non clicca
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Ref per scroll sulla chat quando si apre
  const assistantRef = useRef<HTMLElement | null>(null);

  function openAssistant() {
    setAssistantOpen(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          assistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {}
      }, 50);
    });
  }

  function closeAssistant() {
    setAssistantOpen(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {}
      }, 50);
    });
  }

  // Form
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("RITIRO");
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [note, setNote] = useState("");

  // Scatole
  const [scat50, setScat50] = useState(0);
  const [scat100, setScat100] = useState(0);
  const [scat200, setScat200] = useState(0);

  // Anti-spam
  const [honeypot, setHoneypot] = useState("");

  // Stato submit
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  const timeOptions = useMemo(() => {
    const morning = buildSlots(9, 0, 12, 30, 15);
    const afternoon = buildSlots(15, 0, 20, 30, 15);
    return ["— Mattina —", ...morning, "— Pomeriggio —", ...afternoon];
  }, []);

  const totalArrosticini = useMemo(() => scat50 * 50 + scat100 * 100 + scat200 * 200, [scat50, scat100, scat200]);

  const scatoleLabel = useMemo(() => {
    const parts: string[] = [];
    if (scat50 > 0) parts.push(`50×${scat50}`);
    if (scat100 > 0) parts.push(`100×${scat100}`);
    if (scat200 > 0) parts.push(`200×${scat200}`);
    return parts.length ? parts.join(" · ") : "—";
  }, [scat50, scat100, scat200]);

  const scatoleCompact = useMemo(() => {
    return `50:${scat50} | 100:${scat100} | 200:${scat200} | TOT:${totalArrosticini}`;
  }, [scat50, scat100, scat200, totalArrosticini]);

  const needsAddress = fulfillment === "CONSEGNA";

  function inc(setter: (n: number) => void, value: number) {
    setter(Math.min(99, value + 1));
  }
  function dec(setter: (n: number) => void, value: number) {
    setter(Math.max(0, value - 1));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setStatus("loading");

    const cleanNome = nome.trim();
    const cleanTel = telefono.trim();

    if (!cleanNome || !cleanTel) {
      setStatus("err");
      setMsg("Inserisci nome e telefono.");
      return;
    }
    if (!data) {
      setStatus("err");
      setMsg("Seleziona una data.");
      return;
    }
    if (!ora || ora.startsWith("—")) {
      setStatus("err");
      setMsg("Seleziona un orario.");
      return;
    }
    if (totalArrosticini <= 0) {
      setStatus("err");
      setMsg("Seleziona almeno una scatola (50/100/200).");
      return;
    }
    if (needsAddress && !indirizzo.trim()) {
      setStatus("err");
      setMsg("Per consegna serve l’indirizzo.");
      return;
    }

    const payload = {
      nome: cleanNome,
      telefono: cleanTel,

      tipo: fulfillment,
      ritiroConsegna: fulfillment,

      data,
      ora,

      scatole: scatoleCompact,
      ordine: scatoleCompact,

      scatola50: scat50,
      scatola100: scat100,
      scatola200: scat200,
      totaleArrosticini: totalArrosticini,
      riepilogoScatole: scatoleLabel === "—" ? "" : scatoleLabel,

      indirizzo: needsAddress ? indirizzo.trim() : "",
      stato: DEFAULT_STATUS,
      note: note.trim(),

      canale: "WEBAPP",
      negozio: BRAND_NAME,
      honeypot,
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => null);

      if (!res.ok || out?.ok === false) {
        setStatus("err");
        setMsg(out?.error || "Errore invio. Controlla i log (Vercel).");
        return;
      }

      setStatus("ok");
      setMsg("Prenotazione inviata ✅ Ti ricontattiamo a breve.");

      setScat50(0);
      setScat100(0);
      setScat200(0);
      setNote("");
      setIndirizzo("");
      setOra("");
      setHoneypot("");
    } catch {
      setStatus("err");
      setMsg("Errore rete. Riprova.");
    }
  }

  // Background
  const bgStyle: React.CSSProperties = {
    backgroundImage: "linear-gradient(180deg, rgba(6,10,18,.12), rgba(6,10,18,.42)), url('/bg-arrosticini-day.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  const heroStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(10,14,22,.94), rgba(10,14,22,.80))",
    border: "1px solid rgba(255,255,255,.18)",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(10,14,22,.88)",
    border: "1px solid rgba(255,255,255,.18)",
  };

  return (
    <div className="appShell">
      <div className="bgLayer" style={bgStyle} />

      <div className="wrap">
        <header className="hero" style={heroStyle}>
          <div className="heroTop">
            <div
              className="brandPill"
              style={{
                background: "rgba(255,255,255,.10)",
                border: "1px solid rgba(255,255,255,.18)",
              }}
            >
              🔥 Laboratorio
            </div>

            <div className="heroRight">
              <div className="heroTitleWrap">
                <h1 className="heroTitle" style={{ textShadow: "0 10px 30px rgba(0,0,0,.55)" }}>
                  {BRAND_NAME}
                </h1>
                <p className="heroTag">{TAGLINE}</p>
              </div>

              {/* ✅ tolti Chiama e WhatsApp */}
              <div className="heroActionsHidden" />
            </div>
          </div>

          <div className="heroBar" />

          {/* ✅ tolte le tab Prenota / Assistente */}
          <div className="tabsHidden" />
        </header>

        {/* ✅ layout cambia solo quando assistenza è aperta */}
        <main className={`mainGrid ${assistantOpen ? "assistOpen" : "assistClosed"}`}>
          {/* PRENOTA */}
          <section className="card orderCard" style={cardStyle}>
            <div className="cardInner">
              <div className="sectionHead">
                <h2 className="sectionTitle">Prenota scatole</h2>
                <p className="sectionSub">Ritiro o consegna · Data e ora · Totale automatico.</p>
              </div>

              <form onSubmit={onSubmit} className="formStack">
                <input
                  className="honeypot"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  placeholder="Lascia vuoto"
                  aria-hidden="true"
                />

                <div className="formGrid">
                  <div className="field">
                    <div className="label">Nome</div>
                    <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Marco" />
                  </div>

                  <div className="field">
                    <div className="label">Telefono</div>
                    <input
                      className="input"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Es. 333 000 0000"
                      inputMode="tel"
                    />
                  </div>

                  <div className="field full">
                    <div className="label">Ritiro / Consegna</div>
                    <select className="select" value={fulfillment} onChange={(e) => setFulfillment(e.target.value as Fulfillment)}>
                      <option value="RITIRO">Ritiro</option>
                      <option value="CONSEGNA">Consegna</option>
                    </select>
                  </div>

                  <div className="field full">
                    <div className="label">Data e ora</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />

                      <select className="select" value={ora} onChange={(e) => setOra(e.target.value)} disabled={!data}>
                        <option value="">{data ? "Seleziona un orario" : "Scegli prima la data"}</option>
                        {timeOptions.map((t) =>
                          t.startsWith("—") ? (
                            <option key={t} value={t} disabled>
                              {t}
                            </option>
                          ) : (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="hint">Se non trovi l’orario, scrivilo nelle note.</div>
                  </div>

                  {needsAddress && (
                    <div className="field full">
                      <div className="label">Indirizzo consegna</div>
                      <input
                        className="input"
                        value={indirizzo}
                        onChange={(e) => setIndirizzo(e.target.value)}
                        placeholder="Via, civico, interno, citofono…"
                      />
                    </div>
                  )}
                </div>

                <div className="boxesWrap" style={{ background: "rgba(255,255,255,.05)" }}>
                  <div className="boxesHead">
                    <div>
                      <div className="label">Scatole</div>
                      <div className="mini">Scegli quantità: 50 / 100 / 200 arrosticini</div>
                      <div className="mini" style={{ marginTop: 6 }}>
                        <b>Riepilogo rapido:</b> {scatoleCompact}
                      </div>
                    </div>

                    <div className="totalPill" style={{ background: "rgba(255,255,255,.10)" }}>
                      Totale: <b>{totalArrosticini}</b>
                    </div>
                  </div>

                  <div className="boxesGrid">
                    <div className="boxCard" style={{ background: "rgba(10,12,18,.55)" }}>
                      <div className="boxTitle">Scatola 50</div>
                      <div className="boxSub">50 arrosticini</div>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => dec(setScat50, scat50)} aria-label="Meno 50">
                          −
                        </button>
                        <div className="stepVal">{scat50}</div>
                        <button type="button" className="stepBtn" onClick={() => inc(setScat50, scat50)} aria-label="Più 50">
                          +
                        </button>
                      </div>
                    </div>

                    <div className="boxCard" style={{ background: "rgba(10,12,18,.55)" }}>
                      <div className="boxTitle">Scatola 100</div>
                      <div className="boxSub">100 arrosticini</div>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => dec(setScat100, scat100)} aria-label="Meno 100">
                          −
                        </button>
                        <div className="stepVal">{scat100}</div>
                        <button type="button" className="stepBtn" onClick={() => inc(setScat100, scat100)} aria-label="Più 100">
                          +
                        </button>
                      </div>
                    </div>

                    <div className="boxCard" style={{ background: "rgba(10,12,18,.55)" }}>
                      <div className="boxTitle">Scatola 200</div>
                      <div className="boxSub">200 arrosticini</div>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => dec(setScat200, scat200)} aria-label="Meno 200">
                          −
                        </button>
                        <div className="stepVal">{scat200}</div>
                        <button type="button" className="stepBtn" onClick={() => inc(setScat200, scat200)} aria-label="Più 200">
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="summaryRow">
                    <div className="summaryLeft">
                      <div className="summaryLabel">Riepilogo</div>
                      <div className="summaryText">
                        {scatoleLabel === "—"
                          ? "Seleziona le scatole per vedere il riepilogo."
                          : `Scatole: ${scatoleLabel} · Totale: ${totalArrosticini}`}
                      </div>
                    </div>
                    <div className="summaryRight">{totalArrosticini}</div>
                  </div>
                </div>

                <div className="field">
                  <div className="label">Note (opzionale)</div>
                  <input
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Es. arrivo alle 20:10, citofono, senza sale…"
                  />
                </div>

                <div className="actions">
                  <button className="btnPrimary" disabled={status === "loading"}>
                    {status === "loading" ? "Invio..." : "Invia prenotazione"}
                  </button>
                  <div className={`status ${status}`}>{msg || " "}</div>
                </div>

                <div className="legal">Inviando accetti che il laboratorio ti contatti per conferma disponibilità.</div>
              </form>
            </div>
          </section>

          {/* CHAT (visibile solo quando assistantOpen=true) */}
          <section
            ref={(el) => {
              assistantRef.current = el;
            }}
            className="card chatCard"
            style={cardStyle}
            aria-hidden={assistantOpen ? "false" : "true"}
          >
            <div className="cardInner">
              <div className="sectionHead" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h2 className="sectionTitle">Assistenza</h2>
                  <p className="sectionSub">Domande rapide su ritiro/consegna e info generali.</p>
                </div>

                <button
                  type="button"
                  onClick={closeAssistant}
                  className="btnClose"
                  aria-label="Chiudi assistenza"
                  title="Chiudi"
                >
                  ✕
                </button>
              </div>

              {/* ✅ tolta la scritta “Se vuoi prenotare compila il modulo…” */}
              <ChatBox />
            </div>
          </section>
        </main>

        {/* ✅ barra mobile: 1 solo bottone */}
        <div className="stickyBarOne">
          <button
            className="stickyBtnOne primary"
            onClick={() => {
              if (!assistantOpen) openAssistant();
              else closeAssistant();
            }}
          >
            {!assistantOpen ? "💬 Assistenza" : "🧾 Torna alla prenotazione"}
          </button>
        </div>

        <footer className="footer">
          <b>{BRAND_NAME}</b> · Prenotazioni scatole 50/100/200
        </footer>
      </div>

      <style jsx global>{`
        .bgLayer {
          position: fixed;
          inset: 0;
          z-index: -1;
        }

        .wrap {
          padding-bottom: calc(84px + env(safe-area-inset-bottom));
        }

        .heroTop {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .heroRight {
          flex: 1;
          display: flex;
          gap: 14px;
          justify-content: space-between;
          align-items: flex-start;
          min-width: 0;
        }
        .heroTitleWrap {
          min-width: 0;
        }

        /* ✅ nascondiamo roba non più usata */
        .heroActionsHidden,
        .tabsHidden {
          display: none;
        }

        /* ✅ layout: di base solo modulo */
        .mainGrid.assistClosed {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          align-items: start;
        }
        .mainGrid.assistClosed .chatCard {
          display: none;
        }

        /* ✅ quando assistenza è aperta: su desktop affiancata */
        .mainGrid.assistOpen {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 16px;
          align-items: start;
        }

        /* Bottone chiudi */
        .btnClose {
          height: 40px;
          min-width: 40px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: rgba(244, 246, 255, 0.92);
          font-weight: 900;
          cursor: pointer;
        }

        /* Mobile */
        @media (max-width: 900px) {
          .bgLayer {
            position: absolute;
          }

          .heroTop {
            flex-direction: column;
          }
          .heroRight {
            flex-direction: column;
            width: 100%;
          }

          .heroTitle {
            font-size: 34px;
            line-height: 1.05;
          }
          .heroTag {
            font-size: 14px;
            opacity: 0.92;
          }

          /* ✅ su mobile: quando assistenza aperta, mostra SOLO chat */
          .mainGrid.assistOpen {
            grid-template-columns: 1fr;
          }
          .mainGrid.assistOpen .orderCard {
            display: none;
          }
          .mainGrid.assistOpen .chatCard {
            display: block;
          }

          /* Data/ora: impila su schermi stretti */
          .field.full > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }

        /* Sticky bar: un bottone */
        .stickyBarOne {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 12px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
          background: rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(10px);
          z-index: 50;
        }
        .stickyBtnOne {
          width: 100%;
          border-radius: 16px;
          padding: 14px 14px;
          font-weight: 900;
          text-align: center;
          color: rgba(244, 246, 255, 0.95);
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .stickyBtnOne.primary {
          background: linear-gradient(90deg, #ff3b30, #ffcc00);
          border: none;
          color: rgba(16, 20, 30, 0.92);
        }
      `}</style>
    </div>
  );
}