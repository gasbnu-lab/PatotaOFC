import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

type Despesa = { id: string; descricao: string; valor: number }
type Participante = { id: string; nome: string; valor_devido: number; status: string }

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  const [a, m, d] = iso.split("-")
  return `${d}/${m}/${a}`
}

const statusLabel: Record<string, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" }
const statusColor: Record<string, string> = { pendente: "#d97706", pago: "#16a34a", atrasado: "#dc2626" }

function labelParticipante(p: Participante) {
  if (p.valor_devido === 0 && p.status === "pago") return { valor: "Incluso na mensalidade", badge: "Incluso", cor: "#6366f1" }
  return { valor: fmtBRL(p.valor_devido), badge: statusLabel[p.status] ?? p.status, cor: statusColor[p.status] ?? "#888" }
}

export default function ChurrascoPublico() {
  const { slug, churrasco_id } = useParams<{ slug: string; churrasco_id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [nomePatota, setNomePatota] = useState("")
  const [churrasco, setChurrasco] = useState<{ id: string; data: string; descricao: string | null } | null>(null)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { carregar() }, [slug, churrasco_id])

  async function carregar() {
    setLoading(true)
    setErro(null)

    const s = slug ?? ""
    const isNumeric = /^\d+$/.test(s)
    const patotas = isNumeric
      ? await supabase.from("patota").select("id, nome").eq("id", parseInt(s)).single()
      : await supabase.from("patota").select("id, nome").eq("slug", s).single()

    if (patotas.error || !patotas.data) { setErro("Patota não encontrada."); setLoading(false); return }
    setNomePatota(patotas.data.nome)

    const { data: ch, error: chErr } = await supabase
      .from("churrascos")
      .select("id, data, descricao")
      .eq("id", churrasco_id)
      .eq("patota_id", patotas.data.id)
      .single()

    if (chErr || !ch) { setErro("Churrasco não encontrado."); setLoading(false); return }
    setChurrasco(ch)

    const [{ data: desp }, { data: part }] = await Promise.all([
      supabase.from("churrasco_despesas").select("id, descricao, valor").eq("churrasco_id", ch.id).order("criado_em"),
      supabase
        .from("churrasco_participantes")
        .select("id, nome_avulso, valor_devido, status, jogadores(nome)")
        .eq("churrasco_id", ch.id)
        .order("criado_em"),
    ])

    setDespesas((desp ?? []).map((d: any) => ({ id: d.id, descricao: d.descricao, valor: Number(d.valor) })))
    setParticipantes((part ?? []).map((p: any) => ({
      id: p.id,
      nome: p.jogadores?.nome ?? p.nome_avulso ?? "?",
      valor_devido: Number(p.valor_devido),
      status: p.status,
    })))
    setLoading(false)
  }

  const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans, sans-serif)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <button
          onClick={() => navigate(`/p/${slug}`)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted, #888)", fontSize: "0.85rem", padding: "0 0 1rem 0", display: "block" }}
        >
          ← {nomePatota || "Voltar"}
        </button>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted, #888)" }}>Carregando...</div>
        ) : erro ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#dc2626" }}>{erro}</div>
        ) : churrasco && (
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>🔥</div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>
                {churrasco.descricao || "Churrasco"}
              </h1>
              <div style={{ color: "var(--muted, #888)", fontSize: "0.9rem", marginTop: "0.25rem" }}>{fmtData(churrasco.data)}</div>
            </div>

            {/* Resumo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #eee)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted, #888)" }}>Total gasto</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "0.2rem" }}>{fmtBRL(totalDespesas)}</div>
              </div>
              <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #eee)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted, #888)" }}>Participantes</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "0.2rem" }}>{participantes.length}</div>
              </div>
            </div>

            {/* Despesas */}
            {despesas.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted, #888)", marginBottom: "0.5rem" }}>Despesas</div>
                <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #eee)", borderRadius: 10, overflow: "hidden" }}>
                  {despesas.map((d, i) => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.65rem 1rem", borderBottom: i < despesas.length - 1 ? "1px solid var(--border, #eee)" : "none" }}>
                      <span style={{ fontSize: "0.9rem" }}>{d.descricao}</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#dc2626" }}>{fmtBRL(d.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participantes */}
            {participantes.length > 0 && (
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted, #888)", marginBottom: "0.5rem" }}>Rateio</div>
                <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #eee)", borderRadius: 10, overflow: "hidden" }}>
                  {participantes.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 1rem", borderBottom: i < participantes.length - 1 ? "1px solid var(--border, #eee)" : "none" }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{p.nome}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted, #888)" }}>{labelParticipante(p).valor}</div>
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: labelParticipante(p).cor, background: labelParticipante(p).cor + "18", padding: "0.2rem 0.6rem", borderRadius: 999 }}>
                        {labelParticipante(p).badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
