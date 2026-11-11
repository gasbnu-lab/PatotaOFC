import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../lib/useAuth"
import s from "./admin.module.css"

type Linha = {
  jogador_id: string
  nome: string
  jogos: number
  gols: number
  assistencias: number
  gols_sofridos: number
  canetas: number
}

type Sort = { col: keyof Linha; dir: 1 | -1 }

type Premio = {
  emoji: string
  titulo: string
  lideres: { nome: string; media: number; total: number; jogos: number }[]
  unidade: string
  melhorEhMenor?: boolean
}

function calcPremios(linhas: Linha[]): Premio[] {
  if (linhas.length === 0) return []

  function lider(campo: keyof Linha, menorEhMelhor = false) {
    const comMedia = linhas.map(l => ({
      nome: l.nome,
      total: l[campo] as number,
      jogos: l.jogos,
      media: (l[campo] as number) / l.jogos,
    }))
    const melhor = menorEhMelhor
      ? Math.min(...comMedia.map(x => x.media))
      : Math.max(...comMedia.map(x => x.media))
    return comMedia.filter(x => Math.abs(x.media - melhor) < 0.0001)
  }

  return [
    {
      emoji: "🥇",
      titulo: "Artilheiro",
      lideres: lider("gols"),
      unidade: "gols/jogo",
    },
    {
      emoji: "🧤",
      titulo: "Menos vazado",
      lideres: lider("gols_sofridos", true),
      unidade: "sofridos/jogo",
      melhorEhMenor: true,
    },
    {
      emoji: "🥤",
      titulo: "Quem paga mais Coca",
      lideres: lider("canetas"),
      unidade: "canetas/jogo",
    },
  ]
}

export default function Ranking() {
  const { usuario } = useAuth()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>({ col: "gols", dir: -1 })

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    setErro(null)
    const { data, error } = await supabase
      .from("jogo_estatisticas")
      .select("jogador_id, gols, assistencias, gols_sofridos, canetas, jogadores(nome), jogos!inner(patota_id)")
      .eq("jogos.patota_id", patotatId)
      .not("jogador_id", "is", null)
    if (error) { setErro(`Erro ao carregar ranking: ${error.message}`); setLoading(false); return }

    const mapa = new Map<string, Linha>()
    for (const e of data ?? []) {
      if (!e.jogador_id) continue
      const nome = (e.jogadores as any)?.nome ?? "?"
      const prev = mapa.get(e.jogador_id) ?? { jogador_id: e.jogador_id, nome, jogos: 0, gols: 0, assistencias: 0, gols_sofridos: 0, canetas: 0 }
      mapa.set(e.jogador_id, {
        ...prev,
        jogos: prev.jogos + 1,
        gols: prev.gols + (e.gols ?? 0),
        assistencias: prev.assistencias + (e.assistencias ?? 0),
        gols_sofridos: prev.gols_sofridos + (e.gols_sofridos ?? 0),
        canetas: prev.canetas + (e.canetas ?? 0),
      })
    }
    setLinhas(Array.from(mapa.values()))
    setLoading(false)
  }

  function toggleSort(col: keyof Linha) {
    setSort(prev => prev.col === col ? { col, dir: prev.dir === -1 ? 1 : -1 } : { col, dir: -1 })
  }

  const sorted = [...linhas].sort((a, b) => {
    const va = a[sort.col]
    const vb = b[sort.col]
    if (typeof va === "string") return sort.dir * va.localeCompare(vb as string, "pt-BR")
    return sort.dir * ((vb as number) - (va as number))
  })

  function colHeader(col: keyof Linha, label: string) {
    const ativo = sort.col === col
    return (
      <th
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
        onClick={() => toggleSort(col)}
      >
        {label} {ativo ? (sort.dir === -1 ? "↓" : "↑") : ""}
      </th>
    )
  }

  const premios = calcPremios(linhas)

  if (loading) return <div className={s.page}><div className={s.empty}>Carregando...</div></div>
  if (erro) return <div className={s.page}><div style={{ color: "#dc2626", padding: "1rem" }}>{erro}</div></div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Ranking</h1>
          <div className={s.pageSubtitulo}>{linhas.length} jogador{linhas.length !== 1 ? "es" : ""} com estatísticas</div>
        </div>
      </div>

      {/* Cards de premiação */}
      {linhas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {premios.map(p => (
            <div key={p.titulo} className={s.card} style={{ padding: "1rem 1.1rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{p.emoji}</div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: "0.4rem" }}>{p.titulo}</div>
              {p.lideres.map((l, i) => (
                <div key={l.nome} style={{ marginTop: i > 0 ? "0.3rem" : 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>{l.nome}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    {l.media.toFixed(2)} {p.unidade}
                    <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem" }}>
                      ({l.total} em {l.jogos} jogo{l.jogos !== 1 ? "s" : ""})
                    </span>
                  </div>
                </div>
              ))}
              {p.lideres.length > 1 && (
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  {p.lideres.length} empatados
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {linhas.length === 0 ? (
        <div className={s.card}><div className={s.empty}>Nenhuma estatística lançada ainda. Use o botão 📊 Stats nos jogos passados.</div></div>
      ) : (
        <div className={s.card}>
          <table className={s.table}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                {colHeader("nome", "Jogador")}
                {colHeader("jogos", "Jogos")}
                {colHeader("gols", "⚽ Gols")}
                {colHeader("assistencias", "🅰️ Assist.")}
                {colHeader("gols_sofridos", "🛡️ Sofridos")}
                {colHeader("canetas", "🥤 Canetas")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l, i) => (
                <tr key={l.jogador_id}>
                  <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: "var(--text)" }}>{l.nome}</td>
                  <td>{l.jogos}</td>
                  <td style={{ fontWeight: l.gols > 0 ? 700 : 400 }}>{l.gols}</td>
                  <td>{l.assistencias}</td>
                  <td>{l.gols_sofridos}</td>
                  <td style={{ fontWeight: l.canetas > 0 ? 700 : 400 }}>{l.canetas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
