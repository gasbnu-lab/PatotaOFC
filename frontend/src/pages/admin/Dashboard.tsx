import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useAuth } from "../../lib/useAuth"
import s from "./admin.module.css"

type Lancamento = {
  id: string
  data: string
  categoria: string
  descricao: string
  valor: number
  tipo: "entrada" | "saida"
}

type Convidado = {
  id: string
  nome_convidado: string
  convidado_por_id: string | null
  jogo_id: string
  jogadores?: { nome: string } | null
  jogos?: { data: string } | null
}

type UsuarioPendente = {
  id: string
  nome: string
  email: string | null
  created_at: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [saldo, setSaldo] = useState<number | null>(null)
  const [mensAberto, setMensAberto] = useState(0)
  const [convidadosPend, setConvidadosPend] = useState<Convidado[]>([])
  const [membrosPend, setMembrosPend] = useState<UsuarioPendente[]>([])
  const [extrato, setExtrato] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)

    const [{ data: lancs }, { data: mens }, { data: conv }, { data: membros }] = await Promise.all([
      supabase.from("lancamentos").select("*")
        .eq("patota_id", patotatId).order("data", { ascending: false }).limit(8),
      supabase.from("mensalidades").select("id, pago")
        .eq("patota_id", patotatId).eq("pago", false),
      supabase.from("presencas")
        .select("id, nome_convidado, convidado_por_id, jogo_id, jogadores:convidado_por_id(nome), jogos(data)")
        .eq("convidado", true).eq("confirmado", false).limit(5),
      supabase.from("usuarios").select("id, nome, email, created_at")
        .eq("patota_id", patotatId).eq("status", "pendente"),
    ])

    setExtrato(lancs ?? [])
    setMensAberto(new Set((mens ?? []).map((m: { id: string }) => m.id)).size)
    setConvidadosPend((conv ?? []) as unknown as Convidado[])
    setMembrosPend(membros ?? [])

    const { data: todos } = await supabase.from("lancamentos").select("valor, tipo").eq("patota_id", patotatId)
    const total = (todos ?? []).reduce((acc: number, l: { valor: number; tipo: string }) => {
      return acc + (l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor))
    }, 0)
    setSaldo(total)
    setLoading(false)
  }

  async function aprovarConvidado(id: string, aprovar: boolean) {
    await supabase.from("presencas").update({ confirmado: aprovar }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function aprovarMembro(id: string, status: "aprovado" | "recusado") {
    await supabase.from("usuarios").update({ status }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  function fmtData(iso: string) {
    const [a, m, d] = iso.split("-")
    return `${d}/${m}`
  }

  function fmtMoeda(v: number) {
    return `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
  }

  if (loading) return <div className={s.empty}>Carregando...</div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Visão geral</h1>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate("/admin/jogos")}>
          + Novo jogo
        </button>
      </div>

      {/* Stats */}
      <div className={s.statsGrid}>
        <div className={s.statCard}>
          <div className={s.statLabel}>Saldo em conta</div>
          <div className={s.statValor} style={{ color: (saldo ?? 0) >= 0 ? "var(--confirm)" : "var(--danger)" }}>
            {saldo !== null ? fmtMoeda(saldo) : "—"}
          </div>
        </div>
        <div className={s.statCard}>
          <div className={s.statLabel}>Mensalidades em aberto</div>
          <div className={s.statValor} style={{ color: mensAberto > 0 ? "var(--warning)" : "var(--confirm)" }}>
            {mensAberto} {mensAberto === 1 ? "jogador" : "jogadores"}
          </div>
        </div>
        <div className={s.statCard}>
          <div className={s.statLabel}>Convidados pendentes</div>
          <div className={s.statValor} style={{ color: convidadosPend.length > 0 ? "var(--warning)" : "var(--muted)" }}>
            {convidadosPend.length} aguardando
          </div>
        </div>
        <div className={s.statCard}>
          <div className={s.statLabel}>Novos membros</div>
          <div className={s.statValor} style={{ color: membrosPend.length > 0 ? "var(--warning)" : "var(--muted)" }}>
            {membrosPend.length} pendentes
          </div>
        </div>
      </div>

      <div className={s.grid2}>
        {/* Extrato */}
        <div className={s.card}>
          <div className={s.cardPad} style={{ paddingBottom: "0.5rem" }}>
            <div className={s.cardTitulo}>Extrato — lançamentos recentes</div>
          </div>
          {extrato.length === 0 ? (
            <div className={s.empty}>Nenhum lançamento ainda.</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {extrato.map(l => (
                  <tr key={l.id}>
                    <td>{fmtData(l.data)}</td>
                    <td>{l.categoria}</td>
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={l.tipo === "entrada" ? s.plus : s.minus}>
                        {l.tipo === "entrada" ? "+" : "-"}{fmtMoeda(l.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Aprovar novos membros */}
          <div className={s.card}>
            <div className={s.cardPad} style={{ paddingBottom: "0.5rem" }}>
              <div className={s.cardTitulo}>Aprovar novos membros</div>
            </div>
            {membrosPend.length === 0 ? (
              <div className={s.empty}>Nenhum membro pendente. 👍</div>
            ) : (
              membrosPend.map(m => (
                <div key={m.id} className={s.aprovRow}>
                  <div className={s.aprovNome}>{m.nome || "—"}</div>
                  <div className={s.aprovInfo}>{m.email ?? ""}</div>
                  <div className={s.aprovBtns}>
                    <button className={s.btnAprovar} onClick={() => aprovarMembro(m.id, "aprovado")}>Aprovar</button>
                    <button className={s.btnRecusar} onClick={() => aprovarMembro(m.id, "recusado")}>Recusar</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Aprovar convidados */}
          <div className={s.card}>
            <div className={s.cardPad} style={{ paddingBottom: "0.5rem" }}>
              <div className={s.cardTitulo}>Aprovar convidados</div>
            </div>
            {convidadosPend.length === 0 ? (
              <div className={s.empty}>Nenhum convidado pendente. 👍</div>
            ) : (
              convidadosPend.map(c => (
                <div key={c.id} className={s.aprovRow}>
                  <div className={s.aprovNome}>{c.nome_convidado}</div>
                  <div className={s.aprovInfo}>
                    convidado por {c.jogadores?.nome ?? "—"} · jogo {c.jogos?.data ? fmtData(c.jogos.data) : "—"}
                  </div>
                  <div className={s.aprovBtns}>
                    <button className={s.btnAprovar} onClick={() => aprovarConvidado(c.id, true)}>Aprovar</button>
                    <button className={s.btnRecusar} onClick={() => aprovarConvidado(c.id, false)}>Recusar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
