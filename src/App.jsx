import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabase.js";

const LIKERT_OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad de los días" },
  { value: 3, label: "Casi todos los días" },
];

const GAD_ITEMS = [
  "Sentirse nervioso/a, ansioso/a o con los nervios de punta",
  "No ser capaz de parar o controlar sus preocupaciones",
  "Preocuparse demasiado por diferentes cosas",
  "Tener dificultad para relajarse",
  "Estar tan inquieto/a que es difícil permanecer sentado/a",
  "Molestarse o ponerse irritable fácilmente",
  "Sentir miedo como si algo terrible pudiera pasar",
];

const PHQ_ITEMS = [
  "Poco interés o placer en hacer las cosas",
  "Sentirse decaído/a, deprimido/a o sin esperanza",
  "Problemas para dormir, mantenerse dormido/a o dormir demasiado",
  "Sentirse cansado/a o con poca energía",
  "Poco apetito o comer en exceso",
  "Sentirse mal consigo mismo/a — o sentir que es un fracaso o que ha decepcionado a su familia",
  "Dificultad para concentrarse en actividades como leer el periódico o ver televisión",
  "Moverse o hablar tan lento que otras personas lo notan. O lo contrario — estar tan inquieto/a o agitado/a que se mueve mucho más de lo normal",
  "Pensamientos de que estaría mejor muerto/a o de hacerse daño de alguna manera",
];

function gadSeverity(score) {
  if (score <= 4) return { label: "Mínima", code: 0, color: "#16a34a", bg: "#dcfce7" };
  if (score <= 9) return { label: "Leve", code: 1, color: "#ca8a04", bg: "#fef9c3" };
  if (score <= 14) return { label: "Moderada", code: 2, color: "#ea580c", bg: "#fff7ed" };
  return { label: "Severa", code: 3, color: "#7c3aed", bg: "#f3e8ff" };
}

function phqSeverity(score) {
  if (score <= 4) return { label: "Mínima", code: 0, color: "#16a34a", bg: "#dcfce7" };
  if (score <= 9) return { label: "Leve", code: 1, color: "#ca8a04", bg: "#fef9c3" };
  if (score <= 14) return { label: "Moderada", code: 2, color: "#ea580c", bg: "#fff7ed" };
  if (score <= 19) return { label: "Mod. Severa", code: 3, color: "#dc2626", bg: "#fef2f2" };
  return { label: "Severa", code: 4, color: "#7c3aed", bg: "#f3e8ff" };
}

// ─── Supabase Storage Helpers ───
async function saveResponse(data) {
  const { data: inserted, error } = await supabase
    .from('respuestas')
    .insert([data])
    .select();
  if (error) {
    console.error("Supabase error:", error);
    return null;
  }
  return inserted?.[0]?.id || null;
}

async function loadAllResponses() {
  const { data, error } = await supabase
    .from('respuestas')
    .select('*')
    .order('id', { ascending: true });
  if (error) {
    console.error("Load error:", error);
    return [];
  }
  return data || [];
}

// ─── Components ───
function ProgressBar({ step }) {
  const labels = ["Consentimiento", "Datos", "GAD-7", "PHQ-9"];
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#f0f2f7", padding: "12px 0 8px", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 5 }}>
        {labels.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 3,
            background: i < step ? "#3b6cb5" : i === step ? "#2a9d8f" : "#dce3ed",
            transition: "background 0.4s"
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7c93", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {labels.map((l, i) => <span key={i} style={{ color: i === step ? "#2a9d8f" : i < step ? "#3b6cb5" : undefined }}>{l}</span>)}
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(26,39,68,0.06)",
      border: "1px solid #dce3ed", overflow: "hidden", marginBottom: 16,
      animation: "fadeIn 0.35s ease", ...style
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ number, title, desc, color = "#3b6cb5" }) {
  return (
    <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #eef1f6" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: "50%", background: color,
          color: "#fff", fontSize: 13, fontWeight: 700
        }}>{number}</span>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1a2744", margin: 0 }}>{title}</h2>
      </div>
      {desc && <p style={{ color: "#6b7c93", fontSize: 13.5, marginTop: 5, lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );
}

function LikertItem({ index, text, name, value, onChange, isWarning }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 8px",
      borderBottom: "1px solid #f0f2f7", background: index % 2 === 0 ? "#fafbfd" : "#fff",
      transition: "background 0.15s"
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 24, height: 24, borderRadius: "50%", background: isWarning ? "#fecaca" : "#e8ecf3",
        color: isWarning ? "#b91c1c" : "#6b7c93", fontSize: 11, fontWeight: 700, marginTop: 2
      }}>{index + 1}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: "#2c3e50", lineHeight: 1.45, marginBottom: 8 }}>{text}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LIKERT_OPTIONS.map((opt) => (
            <label key={opt.value} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
              borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 500,
              border: value === opt.value ? "2px solid #2a9d8f" : "1.5px solid #dce3ed",
              background: value === opt.value ? "#e6f7f5" : "#fff",
              color: value === opt.value ? "#1a7a6e" : "#4a5568",
              transition: "all 0.15s", minWidth: 0
            }}>
              <input type="radio" name={name} value={opt.value} checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                style={{ display: "none" }} />
              <span style={{
                width: 16, height: 16, borderRadius: "50%",
                border: value === opt.value ? "5px solid #2a9d8f" : "2px solid #c4cdd8",
                background: "#fff", flexShrink: 0, transition: "all 0.15s"
              }} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score, maxScore, severity }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
      background: "#f5f8fc", borderRadius: 10, border: "1px solid #dce3ed", marginTop: 12
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#1a2744" }}>{score}</div>
        <div style={{ fontSize: 11, color: "#6b7c93" }}>de {maxScore}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7c93", fontWeight: 500 }}>Nivel de severidad</div>
        <span style={{
          display: "inline-block", padding: "3px 10px", borderRadius: 5,
          fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
          background: severity.bg, color: severity.color, marginTop: 3
        }}>{severity.label}</span>
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style: s }) {
  const styles = {
    primary: { background: "#3b6cb5", color: "#fff" },
    teal: { background: "#2a9d8f", color: "#fff" },
    outline: { background: "transparent", color: "#6b7c93", border: "1.5px solid #dce3ed" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600,
      border: "none", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
      display: "inline-flex", alignItems: "center", gap: 6,
      ...styles[variant], ...s
    }}>{children}</button>
  );
}

// ─── Main App ───
export default function App() {
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [socio, setSocio] = useState({ nombre: "", edad: "", sexo: "", semestre: "", mano: "" });
  const [gad, setGad] = useState(Array(7).fill(null));
  const [phq, setPhq] = useState(Array(9).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [adminAuth, setAdminAuth] = useState(false);

  const ADMIN_PWD = import.meta.env.VITE_ADMIN_PASSWORD || "cambiar-esta-clave";

  const gadTotal = gad.every((v) => v !== null) ? gad.reduce((a, b) => a + b, 0) : null;
  const phqTotal = phq.every((v) => v !== null) ? phq.reduce((a, b) => a + b, 0) : null;

  const goTo = (s) => { setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const validateSocio = () => {
    if (!socio.nombre.trim() || !socio.edad || !socio.sexo || !socio.semestre || !socio.mano) {
      alert("Por favor complete todos los campos."); return;
    }
    if (parseInt(socio.edad) < 16 || parseInt(socio.edad) > 65) {
      alert("Verifique la edad ingresada (16-65)."); return;
    }
    goTo(2);
  };

  const handleSubmit = async () => {
    if (phq.some((v) => v === null)) { alert("Responda todos los ítems del PHQ-9."); return; }
    setSaving(true);
    setSaveError(false);
    const gadS = gadSeverity(gadTotal);
    const phqS = phqSeverity(phqTotal);
    const data = {
      nombre: socio.nombre.trim(),
      edad: parseInt(socio.edad),
      sexo: socio.sexo === "1" ? "M" : "F",
      semestre: parseInt(socio.semestre),
      mano: socio.mano,
      gad1: gad[0], gad2: gad[1], gad3: gad[2], gad4: gad[3], gad5: gad[4], gad6: gad[5], gad7: gad[6],
      gad_total: gadTotal, gad_sev: gadS.label, gad_sev_cod: gadS.code,
      phq1: phq[0], phq2: phq[1], phq3: phq[2], phq4: phq[3], phq5: phq[4], phq6: phq[5], phq7: phq[6], phq8: phq[7], phq9: phq[8],
      phq_total: phqTotal, phq_sev: phqS.label, phq_sev_cod: phqS.code,
    };
    const result = await saveResponse(data);
    setSaving(false);
    if (result) {
      setSubmitted(true);
      goTo(4);
    } else {
      setSaveError(true);
    }
  };

  const resetForm = () => {
    setConsent(false); setSocio({ nombre: "", edad: "", sexo: "", semestre: "", mano: "" });
    setGad(Array(7).fill(null)); setPhq(Array(9).fill(null));
    setSubmitted(false); setStep(0);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await loadAllResponses();
    setAllData(data);
    setLoading(false);
  }, []);

  const exportXLSX = () => {
    if (allData.length === 0) return;
    const headers = ["ID","Fecha","Nombre","Edad","Sexo","Semestre","Mano_Dominante",
      "GAD1","GAD2","GAD3","GAD4","GAD5","GAD6","GAD7","GAD7_Total","GAD7_Severidad","GAD7_Severidad_Cod",
      "PHQ1","PHQ2","PHQ3","PHQ4","PHQ5","PHQ6","PHQ7","PHQ8","PHQ9","PHQ9_Total","PHQ9_Severidad","PHQ9_Severidad_Cod","PHQ9_Item9_Alerta"];
    const rows = allData.map((r) => [
      r.id,
      r.fecha ? new Date(r.fecha).toLocaleString("es-CO") : "",
      r.nombre, r.edad, r.sexo, r.semestre, r.mano,
      r.gad1, r.gad2, r.gad3, r.gad4, r.gad5, r.gad6, r.gad7, r.gad_total, r.gad_sev, r.gad_sev_cod,
      r.phq1, r.phq2, r.phq3, r.phq4, r.phq5, r.phq6, r.phq7, r.phq8, r.phq9, r.phq_total, r.phq_sev, r.phq_sev_cod,
      r.phq9 >= 1 ? "SÍ" : "NO"
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 6 }, { wch: 5 }, { wch: 9 }, { wch: 14 },
      { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Base_de_Datos");

    const gadRef = [
      ["Puntaje GAD-7", "Severidad", "Código"],
      ["0-4", "Mínima", 0], ["5-9", "Leve", 1], ["10-14", "Moderada", 2], ["15-21", "Severa", 3]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gadRef), "GAD7_Referencia");

    const phqRef = [
      ["Puntaje PHQ-9", "Severidad", "Código"],
      ["0-4", "Mínima", 0], ["5-9", "Leve", 1], ["10-14", "Moderada", 2], ["15-19", "Moderadamente Severa", 3], ["20-27", "Severa", 4]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(phqRef), "PHQ9_Referencia");

    XLSX.writeFile(wb, `Datos_Proyecto_Aula_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tryAdminLogin = () => {
    if (adminPwd === ADMIN_PWD) {
      setAdminAuth(true);
      loadData();
    } else {
      alert("Contraseña incorrecta");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f7", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        body { margin: 0; }
      `}</style>

      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #2a3d5e 50%, #3b6cb5 100%)",
        padding: "28px 20px 22px", textAlign: "center", position: "relative"
      }}>
        <h1 style={{ color: "#fff", fontSize: "clamp(15px, 3.5vw, 20px)", fontWeight: 700, margin: 0, maxWidth: 650, marginInline: "auto", lineHeight: 1.35 }}>
          Proyecto de Aula — Fisiología del Ejercicio
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 6 }}>
          Relación entre síntomas de ansiedad y depresión e indicadores de condición física
        </p>
        <div style={{
          display: "inline-block", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
          padding: "4px 14px", borderRadius: 20, fontSize: 10.5, color: "rgba(255,255,255,0.8)",
          marginTop: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em"
        }}>
          Universidad Simón Bolívar · Fisioterapia
        </div>
        <button onClick={() => { setShowPanel(!showPanel); setAdminAuth(false); setAdminPwd(""); }}
          style={{
            position: "absolute", top: 10, right: 12, background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "5px 10px",
            color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600
          }}>
          {showPanel ? "✕ Cerrar" : "🔒 Admin"}
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "12px 12px 50px" }}>

        {showPanel && !adminAuth && (
          <Card>
            <SectionHeader number="🔒" title="Acceso administrador" desc="Ingrese la contraseña para ver y descargar los datos." />
            <div style={{ padding: "16px 20px 20px" }}>
              <input type="password" placeholder="Contraseña" value={adminPwd}
                onChange={(e) => setAdminPwd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tryAdminLogin()}
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dce3ed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
              <Btn onClick={tryAdminLogin}>Ingresar</Btn>
            </div>
          </Card>
        )}

        {showPanel && adminAuth && (
          <Card>
            <div style={{ padding: "14px 20px", background: "linear-gradient(135deg,#1a2744,#2a3d5e)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>📊 Panel de Datos</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#2a9d8f" }}>{allData.length}</span>
            </div>
            <div style={{ padding: 16 }}>
              {loading ? (
                <p style={{ textAlign: "center", color: "#6b7c93", fontSize: 13 }}>Cargando respuestas...</p>
              ) : allData.length === 0 ? (
                <p style={{ textAlign: "center", color: "#6b7c93", fontSize: 13 }}>Aún no hay respuestas registradas.</p>
              ) : (
                <>
                  <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #dce3ed" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: "#f0f3f8" }}>
                          {["ID","Nombre","Edad","Sexo","GAD-7","Sev.","PHQ-9","Sev.","Í9"].map((h, i) => (
                            <th key={i} style={{ padding: "7px 6px", fontWeight: 700, textAlign: "left", borderBottom: "2px solid #dce3ed", color: "#1a2744", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allData.map((r, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd" }}>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6" }}>{r.id}</td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6" }}>{r.edad}</td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6" }}>{r.sexo}</td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6", fontWeight: 700 }}>{r.gad_total}</td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6" }}>
                              <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: gadSeverity(r.gad_total).bg, color: gadSeverity(r.gad_total).color }}>{r.gad_sev}</span>
                            </td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6", fontWeight: 700 }}>{r.phq_total}</td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6" }}>
                              <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: phqSeverity(r.phq_total).bg, color: phqSeverity(r.phq_total).color }}>{r.phq_sev}</span>
                            </td>
                            <td style={{ padding: "5px 6px", borderBottom: "1px solid #eef1f6", color: r.phq9 >= 1 ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {r.phq9 >= 1 ? `⚠ ${r.phq9}` : "0"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Btn onClick={exportXLSX}>⬇ Descargar Excel (.xlsx)</Btn>
                    <Btn variant="outline" onClick={loadData}>🔄 Actualizar</Btn>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {!showPanel && !submitted && <ProgressBar step={step} />}

        {step === 0 && !submitted && !showPanel && (
          <Card>
            <SectionHeader number="1" title="Consentimiento Informado" desc="Por favor lea cuidadosamente antes de continuar" />
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{
                background: "#f8f9fc", border: "1px solid #dce3ed", borderRadius: 10,
                padding: 16, fontSize: 13, lineHeight: 1.7, maxHeight: 300, overflowY: "auto", marginBottom: 16, color: "#2c3e50"
              }}>
                <h3 style={{ fontSize: 14, color: "#1a2744", margin: "0 0 6px" }}>Información del Estudio</h3>
                <p>Usted ha sido invitado/a a participar en el proyecto de aula titulado <strong>"Relación entre los síntomas de ansiedad y depresión y los indicadores de condición física y composición corporal en estudiantes de fisioterapia"</strong>, desarrollado en el curso de Fisiología del Ejercicio del programa de Fisioterapia de la Universidad Simón Bolívar.</p>
                <h3 style={{ fontSize: 14, color: "#1a2744", margin: "14px 0 6px" }}>Propósito</h3>
                <p>Analizar la asociación entre los síntomas de ansiedad y depresión y los indicadores de condición física y composición corporal en estudiantes del programa.</p>
                <h3 style={{ fontSize: 14, color: "#1a2744", margin: "14px 0 6px" }}>Procedimiento</h3>
                <p>(1) Diligenciar este formulario con datos sociodemográficos y cuestionarios GAD-7 y PHQ-9; (2) Asistir a sesión presencial para medición de composición corporal (InBody 270i) y fuerza de prensión manual (Jamar).</p>
                <h3 style={{ fontSize: 14, color: "#1a2744", margin: "14px 0 6px" }}>Riesgos</h3>
                <p>Riesgo mínimo. Algunas preguntas abordan temas sensibles sobre estado emocional. Puede omitir preguntas o retirarse sin consecuencias.</p>
                <h3 style={{ fontSize: 14, color: "#1a2744", margin: "14px 0 6px" }}>Confidencialidad</h3>
                <p>La información será tratada confidencialmente, codificada numéricamente y usada exclusivamente con fines académicos.</p>
                <h3 style={{ fontSize: 14, color: "#1a2744", margin: "14px 0 6px" }}>Participación Voluntaria</h3>
                <p>Su participación es completamente voluntaria. Puede retirarse en cualquier momento sin afectar su calificación ni situación académica.</p>
              </div>
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
                background: "linear-gradient(135deg,#f0f7f5,#eef4f9)", borderRadius: 10,
                border: consent ? "2px solid #2a9d8f" : "1.5px solid #dce3ed", cursor: "pointer", transition: "all 0.2s"
              }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: "#2a9d8f", marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>
                  He leído y comprendido la información anterior. Acepto participar voluntariamente en este estudio y autorizo el uso de mis datos con fines académicos e investigativos.
                </span>
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <Btn disabled={!consent} onClick={() => goTo(1)}>Continuar →</Btn>
              </div>
            </div>
          </Card>
        )}

        {step === 1 && !submitted && !showPanel && (
          <Card>
            <SectionHeader number="2" title="Datos Sociodemográficos" desc="Información general del participante" />
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 5 }}>
                  Nombre completo <span style={{ color: "#e76f51" }}>*</span>
                </label>
                <input type="text" placeholder="Ej: Juan Pérez García" value={socio.nombre}
                  onChange={(e) => setSocio({ ...socio, nombre: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dce3ed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                <p style={{ fontSize: 11, color: "#6b7c93", marginTop: 4 }}>Escriba el nombre tal como aparece en el registro del InBody para facilitar el cruce de datos.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 5 }}>
                    Edad <span style={{ color: "#e76f51" }}>*</span>
                  </label>
                  <input type="number" min="16" max="65" placeholder="Ej: 21" value={socio.edad}
                    onChange={(e) => setSocio({ ...socio, edad: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dce3ed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 5 }}>
                    Sexo <span style={{ color: "#e76f51" }}>*</span>
                  </label>
                  <select value={socio.sexo} onChange={(e) => setSocio({ ...socio, sexo: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dce3ed", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                    <option value="">Seleccione...</option>
                    <option value="1">Masculino</option>
                    <option value="2">Femenino</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 5 }}>
                    Semestre <span style={{ color: "#e76f51" }}>*</span>
                  </label>
                  <select value={socio.semestre} onChange={(e) => setSocio({ ...socio, semestre: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dce3ed", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                    <option value="">Seleccione...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map((s) => <option key={s} value={s}>{s}°</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 5 }}>
                    Mano dominante <span style={{ color: "#e76f51" }}>*</span>
                  </label>
                  <select value={socio.mano} onChange={(e) => setSocio({ ...socio, mano: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #dce3ed", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                    <option value="">Seleccione...</option>
                    <option value="D">Derecha</option>
                    <option value="I">Izquierda</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                <Btn variant="outline" onClick={() => goTo(0)}>← Atrás</Btn>
                <Btn onClick={validateSocio}>Continuar →</Btn>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && !submitted && !showPanel && (
          <Card>
            <SectionHeader number="3" title="GAD-7 — Escala de Ansiedad" color="#2a9d8f"
              desc={<>Durante las <strong>últimas 2 semanas</strong>, ¿con qué frecuencia le han molestado los siguientes problemas?</>} />
            <div style={{ padding: "4px 12px 20px" }}>
              {GAD_ITEMS.map((item, i) => (
                <LikertItem key={i} index={i} text={item} name={`gad${i}`} value={gad[i]}
                  onChange={(v) => { const n = [...gad]; n[i] = v; setGad(n); }} />
              ))}
              {gadTotal !== null && <ScoreBadge score={gadTotal} maxScore={21} severity={gadSeverity(gadTotal)} />}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                <Btn variant="outline" onClick={() => goTo(1)}>← Atrás</Btn>
                <Btn variant="teal" disabled={gad.some((v) => v === null)}
                  onClick={() => { if (gad.some((v) => v === null)) { alert("Responda todos los ítems."); return; } goTo(3); }}>
                  Continuar →
                </Btn>
              </div>
            </div>
          </Card>
        )}

        {step === 3 && !submitted && !showPanel && (
          <Card>
            <SectionHeader number="4" title="PHQ-9 — Cuestionario de Depresión" color="#2a9d8f"
              desc={<>Durante las <strong>últimas 2 semanas</strong>, ¿con qué frecuencia le han molestado los siguientes problemas?</>} />
            <div style={{ padding: "4px 12px 20px" }}>
              {PHQ_ITEMS.map((item, i) => (
                <LikertItem key={i} index={i} text={item} name={`phq${i}`} value={phq[i]}
                  isWarning={i === 8}
                  onChange={(v) => { const n = [...phq]; n[i] = v; setPhq(n); }} />
              ))}

              {phq[8] !== null && phq[8] >= 1 && (
                <div style={{
                  display: "flex", gap: 10, padding: "12px 14px", marginTop: 10,
                  background: "linear-gradient(135deg,#fef3f0,#fde8e0)", border: "1px solid #f0b8a8",
                  borderLeft: "4px solid #e76f51", borderRadius: 10, animation: "fadeIn 0.3s"
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                  <div style={{ fontSize: 12.5, color: "#8b3a25", lineHeight: 1.5 }}>
                    <strong style={{ color: "#e76f51" }}>Alerta — Ítem 9:</strong> El participante ha indicado pensamientos de hacerse daño.
                    Este dato será registrado y debe ser reportado al docente responsable del proyecto.
                  </div>
                </div>
              )}

              {phqTotal !== null && <ScoreBadge score={phqTotal} maxScore={27} severity={phqSeverity(phqTotal)} />}

              {saveError && (
                <div style={{
                  display: "flex", gap: 10, padding: "12px 14px", marginTop: 10,
                  background: "#fef2f2", border: "1px solid #fca5a5",
                  borderLeft: "4px solid #dc2626", borderRadius: 10
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>❌</span>
                  <div style={{ fontSize: 12.5, color: "#991b1b", lineHeight: 1.5 }}>
                    <strong>Error al guardar.</strong> Verifique su conexión a internet e intente nuevamente.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                <Btn variant="outline" onClick={() => goTo(2)}>← Atrás</Btn>
                <Btn variant="teal" disabled={phq.some((v) => v === null) || saving}
                  onClick={handleSubmit}>
                  {saving ? "Guardando..." : "Enviar respuestas ✓"}
                </Btn>
              </div>
            </div>
          </Card>
        )}

        {submitted && !showPanel && (
          <Card>
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(135deg,#2a9d8f,#40b4a6)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, color: "#fff", marginBottom: 16,
                boxShadow: "0 6px 24px rgba(42,157,143,0.25)"
              }}>✓</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2744", margin: "0 0 8px" }}>¡Formulario completado!</h2>
              <p style={{ color: "#6b7c93", fontSize: 14, maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.55 }}>
                Sus respuestas han sido registradas exitosamente. Recuerde asistir a la sesión presencial para las mediciones de composición corporal (InBody) y fuerza de prensión manual (Jamar).
              </p>
              <Btn onClick={resetForm}>Registrar nuevo participante</Btn>
            </div>
          </Card>
        )}
      </div>

      <div style={{ textAlign: "center", padding: 16, fontSize: 11, color: "#6b7c93", borderTop: "1px solid #dce3ed" }}>
        Universidad Simón Bolívar · Programa de Fisioterapia · Fisiología del Ejercicio<br />
        Proyecto de Aula 2026 · Datos confidenciales de uso exclusivamente académico
      </div>
    </div>
  );
}
