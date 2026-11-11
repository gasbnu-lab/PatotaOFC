import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import type { Usuario } from "../../lib/useAuth"
import s from "./admin.module.css"
import ss from "./Sorteio.module.css"

type Ctx = { usuario: Usuario; nomeTime: string }

type Jogo = {
  id: string
  data: string
  horario: string
  local: string
  status: string
  max_jogadores: number | null
}

type JogadorSorteio = {
  time_label: string
  jogador_id: string | null
  convidado_id: string | null
  nome: string
  rating: number
}

type Time = { label: string; jogadores: JogadorSorteio[] }

const MIN_CONFIRMADOS = 12

function fmtData(iso: string) {
  const [a, m, d] = iso.split("-")
  return `${d}/${m}/${a}`
}
function fmtHora(h: string) { return h.slice(0, 5) }
function diaSemana(iso: string) {
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  const [a, m, d] = iso.split("-").map(Number)
  return dias[new Date(a, m - 1, d).getDay()]
}
function mediaRating(jogs: JogadorSorteio[]) {
  if (!jogs.length) return 0
  return (jogs.reduce((s, j) => s + j.rating, 0) / jogs.length).toFixed(1)
}

export default function Sorteio() {
  const { usuario } = useOutletContext<Ctx>()
  const [jogo, setJogo] = useState<Jogo | null>(null)
  const [times, setTimes] = useState<Time[]>([])
  const [loading, setLoading] = useState(true)
  const [sorteando, setSorteando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sorteioSalvo, setSorteioSalvo] = useState(false)
  const [numConfirmados, setNumConfirmados] = useState(0)
  const [todosJogadores, setTodosJogadores] = useState<{ id: string; nome: string }[]>([])
  const [confirmadosIds, setConfirmadosIds] = useState<Set<string>>(new Set())
  const [extrasIds, setExtrasIds] = useState<Set<string>>(new Set())

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErro(null)
    const hoje = new Date().toISOString().split("T")[0]

    const { data: jogos } = await supabase
      .from("jogos")
      .select("*")
      .eq("patota_id", usuario.patota_id)
      .gte("data", hoje)
      .in("status", ["agendado", "confirmado"])
      .order("data")
      .limit(1)

    const proximoJogo = jogos?.[0] ?? null
    setJogo(proximoJogo)

    // Carrega todos os jogadores da patota
    const { data: jogs } = await supabase
      .from("jogadores")
      .select("id, nome")
      .eq("patota_id", usuario.patota_id)
      .eq("ativo", true)
      .order("nome")
    setTodosJogadores(jogs ?? [])

    if (proximoJogo) {
      // conta confirmados e guarda quais jogadores confirmaram
      const { data: presConf } = await supabase
        .from("presencas")
        .select("jogador_id")
        .eq("jogo_id", proximoJogo.id)
        .eq("confirmado", true)
      const ids = new Set((presConf ?? []).map((p: any) => p.jogador_id).filter(Boolean) as string[])
      setConfirmadosIds(ids)
      const count = ids.size + (presConf ?? []).filter((p: any) => !p.jogador_id).length
      setNumConfirmados(count)

      const { data: salvo } = await supabase
        .from("sorteio_times")
        .select("*")
        .eq("jogo_id", proximoJogo.id)
        .order("criado_em", { ascending: false })

      if (salvo && salvo.length > 0) {
        setTimes(agrupar(salvo))
        setSorteioSalvo(true)
      }
    }

    setLoading(false)
  }

  function agrupar(rows: JogadorSorteio[]): Time[] {
    const mapa = new Map<string, JogadorSorteio[]>()
    for (const r of rows) {
      const arr = mapa.get(r.time_label) ?? []
      arr.push(r)
      mapa.set(r.time_label, arr)
    }
    return Array.from(mapa.entries()).map(([label, jogadores]) => ({ label, jogadores }))
  }

  function toggleExtra(id: string) {
    setExtrasIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const totalParaSortear = numConfirmados + extrasIds.size

  async function sortear() {
    if (!jogo) return
    if (totalParaSortear < MIN_CONFIRMADOS) {
      setErro(`São necessários pelo menos ${MIN_CONFIRMADOS} confirmados para sortear. Atualmente: ${totalParaSortear}.`)
      return
    }
    setSorteando(true)
    setErro(null)

    // Inserir presença confirmada para os extras selecionados
    if (extrasIds.size > 0) {
      const inserts = Array.from(extrasIds)
        .filter(id => !confirmadosIds.has(id))
        .map(jogador_id => ({ jogo_id: jogo.id, jogador_id, confirmado: true, convidado: false, aprovado: false }))
      if (inserts.length > 0) {
        await supabase.from("presencas").upsert(inserts, { onConflict: "jogo_id,jogador_id" })
      }
    }

    const { data, error } = await supabase.rpc("sortear_times", { p_jogo_id: jogo.id })

    if (error) {
      const msg = error.message.includes("admin")
        ? "Apenas administradores podem sortear times."
        : error.message.includes("jogadores")
        ? "Confirmados insuficientes para formar times."
        : `Erro: ${error.message}`
      setErro(msg)
      setSorteando(false)
      return
    }

    if (!data || data.length === 0) {
      setErro("Nenhum jogador confirmado para sortear.")
      setSorteando(false)
      return
    }

    await supabase.from("sorteio_times").delete().eq("jogo_id", jogo.id)

    const rows = (data as JogadorSorteio[]).map(r => ({
      jogo_id: jogo.id,
      patota_id: usuario.patota_id,
      time_label: r.time_label,
      jogador_id: r.jogador_id ?? null,
      convidado_id: r.convidado_id ?? null,
      nome: r.nome,
      rating: r.rating,
    }))

    await supabase.from("sorteio_times").insert(rows)

    setTimes(agrupar(data as JogadorSorteio[]))
    setSorteioSalvo(true)
    setSorteando(false)
  }

  const confirmados = times.flatMap(t => t.jogadores).length
  const podeSortear = numConfirmados >= MIN_CONFIRMADOS

  if (loading) return (
    <div className={s.page}>
      <div className={s.pageHeader}><h1 className={s.pageTitulo}>Sorteio de times</h1></div>
      <div className={ss.spinner} />
    </div>
  )

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.pageTitulo}>Sorteio de times</div>
          <div className={s.pageSubtitulo}>Sorteio balanceado por nível</div>
        </div>
      </div>

      {jogo ? (
        <div className={ss.jogoCard}>
          <div className={ss.jogoIcon}>⚽</div>
          <div className={ss.jogoInfo}>
            <div className={ss.jogoData}>{diaSemana(jogo.data)}, {fmtData(jogo.data)} · {fmtHora(jogo.horario)}</div>
            <div className={ss.jogoLocal}>📍 {jogo.local}</div>
          </div>
          <div className={ss.jogoBadge} style={{ color: totalParaSortear >= MIN_CONFIRMADOS ? "#16a34a" : "#dc2626" }}>
            {numConfirmados}/{MIN_CONFIRMADOS} confirmados{extrasIds.size > 0 ? ` (+${extrasIds.size})` : ""}
          </div>
        </div>
      ) : (
        <div className={ss.vazio}>
          <div className={ss.vazioIcon}>📅</div>
          <div>Nenhum jogo agendado. Crie um jogo primeiro.</div>
        </div>
      )}

      {jogo && (
        <>
          {/* Jogadores não confirmados que admin pode incluir manualmente */}
          {todosJogadores.filter(j => !confirmadosIds.has(j.id)).length > 0 && (() => {
            const naoConfirmados = todosJogadores.filter(j => !confirmadosIds.has(j.id))
            const todosMarcados = naoConfirmados.every(j => extrasIds.has(j.id))
            return (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.9rem 1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                    Incluir manualmente no sorteio
                  </div>
                  <button
                    style={{ fontSize: "0.78rem", color: "var(--primary, #6366f1)", background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0.3rem", fontWeight: 600 }}
                    onClick={() => {
                      if (todosMarcados) {
                        setExtrasIds(new Set())
                      } else {
                        setExtrasIds(new Set(naoConfirmados.map(j => j.id)))
                      }
                    }}
                  >
                    {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.6rem" }}>
                  Marque jogadores que vão aparecer mas ainda não confirmaram no app. A presença deles será registrada como confirmada.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {naoConfirmados.map(j => (
                    <label key={j.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", padding: "0.3rem 0.6rem", borderRadius: 6, border: `1px solid ${extrasIds.has(j.id) ? "var(--primary, #6366f1)" : "var(--border)"}`, background: extrasIds.has(j.id) ? "var(--accent-bg, #eef2ff)" : "var(--surface2)", fontSize: "0.82rem", fontWeight: extrasIds.has(j.id) ? 600 : 400, color: "var(--text)" }}>
                      <input type="checkbox" checked={extrasIds.has(j.id)} onChange={() => toggleExtra(j.id)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                      {j.nome}
                    </label>
                  ))}
                </div>
                {extrasIds.size > 0 && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {extrasIds.size} extra{extrasIds.size !== 1 ? "s" : ""} selecionado{extrasIds.size !== 1 ? "s" : ""} · total para sorteio: {totalParaSortear}
                  </div>
                )}
              </div>
            )
          })()}

          {!podeSortear && totalParaSortear < MIN_CONFIRMADOS && (
            <div className={ss.erro} style={{ background: "#fef9c3", borderColor: "#f59e0b", color: "#92400e" }}>
              Aguardando mais jogadores. Mínimo de {MIN_CONFIRMADOS} para sortear (faltam {MIN_CONFIRMADOS - totalParaSortear}).
            </div>
          )}

          {erro && <div className={ss.erro}>{erro}</div>}

          <button
            className={ss.btnSortear}
            onClick={sortear}
            disabled={sorteando || totalParaSortear < MIN_CONFIRMADOS}
            style={totalParaSortear < MIN_CONFIRMADOS ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {sorteando ? (
              <><span className={ss.btnSpinner} /> Sorteando...</>
            ) : sorteioSalvo ? (
              "🎲 Sortear novamente"
            ) : (
              "🎲 Sortear times"
            )}
          </button>

          {times.length > 0 && (
            <div className={ss.timesGrid}>
              {times.map(time => (
                <div key={time.label} className={ss.timeCard}>
                  <div className={ss.timeHeader}>
                    <span className={ss.timeLabel}>{time.label}</span>
                    <span className={ss.timeMedia}>⭐ {mediaRating(time.jogadores)}</span>
                  </div>
                  <ul className={ss.timeList}>
                    {time.jogadores.map((j, i) => (
                      <li key={i} className={ss.timeItem}>
                        <div className={ss.itemAvatar}>{j.nome[0].toUpperCase()}</div>
                        <span className={ss.itemNome}>{j.nome}</span>
                        <span className={ss.itemRating}>{j.rating}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {times.length === 0 && !erro && totalParaSortear >= MIN_CONFIRMADOS && (
            <div className={ss.hint}>
              Clique em "Sortear times" para gerar os times balanceados com os {totalParaSortear} jogadores.
            </div>
          )}
        </>
      )}
    </div>
  )
}
