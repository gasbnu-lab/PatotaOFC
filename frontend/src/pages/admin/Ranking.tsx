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
}

type Sort = { col: keyof Linha; dir: 1 | -1 }

export default function Ranking() {
  const { usuario } = useAuth()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<Sort>({ col: "gols", dir: -1 })

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    // Busca todas as estatísticas de jogadores desta patota
    const { data } = await supabase
      .from("jogo_estatisticas")
      .select("jogador_id, gols, assistencias, gols_sofridos, jogadores(nome), jogos!inner(patota_id)")
      .eq("jogos.patota_id", patotatId)
      .not("jogador_id", "is", null)

    // Agrega por jogador
    const mapa = new Map<string, Linha>()
    for (const e of data ?? []) {
      if (!e.jogador_id) continue
      const nome = (e.jogadores as any)?.nome ?? "?"
      const prev = mapa.get(e.jogador_id) ?? { jogador_id: e.jogador_id, nome, jogos: 0, gols: 0, assistencias: 0, gols_sofridos: 0 }
      mapa.set(e.jogador_id, {
        ...prev,
        jogos: prev.jogos + 1,
        gols: prev.gols + (e.gols ?? 0),
        assistencias: prev.assistencias + (e.assistencias ?? 0),
        gols_sofridos: prev.gols_sofridos + (e.gols_sofridos ?? 0),
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

  if (loading) return <div className={s.page}><div className={s.empty}>Carregando...</div></div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Ranking</h1>
          <div className={s.pageSubtitulo}>{linhas.length} jogador{linhas.length !== 1 ? "es" : ""} com estatísticas</div>
        </div>
      </div>

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
