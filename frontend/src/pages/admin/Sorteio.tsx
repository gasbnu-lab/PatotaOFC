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

    if (proximoJogo) {
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

  async function sortear() {
    if (!jogo) return
    setSorteando(true)
    setErro(null)

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

    // Persiste: apaga sorteio anterior e insere novo
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

      {/* Card do jogo */}
      {jogo ? (
        <div className={ss.jogoCard}>
          <div className={ss.jogoIcon}>⚽</div>
          <div className={ss.jogoInfo}>
            <div className={ss.jogoData}>{diaSemana(jogo.data)}, {fmtData(jogo.data)} · {fmtHora(jogo.horario)}</div>
            <div className={ss.jogoLocal}>📍 {jogo.local}</div>
          </div>
          {sorteioSalvo && (
            <div className={ss.jogoBadge}>{confirmados} jogadores · {times.length} times</div>
          )}
        </div>
      ) : (
        <div className={ss.vazio}>
          <div className={ss.vazioIcon}>📅</div>
          <div>Nenhum jogo agendado. Crie um jogo primeiro.</div>
        </div>
      )}

      {jogo && (
        <>
          {erro && <div className={ss.erro}>{erro}</div>}

          {/* Botão sortear */}
          <button
            className={ss.btnSortear}
            onClick={sortear}
            disabled={sorteando}
          >
            {sorteando ? (
              <><span className={ss.btnSpinner} /> Sorteando...</>
            ) : sorteioSalvo ? (
              "🎲 Sortear novamente"
            ) : (
              "🎲 Sortear times"
            )}
          </button>

          {/* Times */}
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

          {times.length === 0 && !erro && (
            <div className={ss.hint}>
              Clique em "Sortear times" para gerar os times balanceados com os jogadores confirmados.
            </div>
          )}
        </>
      )}
    </div>
  )
}
