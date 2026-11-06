import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import Logo from "../components/Logo"
import styles from "./SorteioPublico.module.css"

type Jogo = { id: string; data: string; horario: string; local: string }
type JogadorSorteio = { time_label: string; nome: string; rating: number }
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
  if (!jogs.length) return "—"
  return (jogs.reduce((s, j) => s + j.rating, 0) / jogs.length).toFixed(1)
}

export default function SorteioPublico() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [jogo, setJogo] = useState<Jogo | null>(null)
  const [times, setTimes] = useState<Time[]>([])
  const [nomeTime, setNomeTime] = useState("")

  useEffect(() => { if (slug) carregar(slug) }, [slug])

  async function carregar(s: string) {
    setLoading(true)

    const isNumeric = /^\d+$/.test(s)
    const { data: pat } = isNumeric
      ? await supabase.from("patota").select("id, nome").eq("id", parseInt(s)).maybeSingle()
      : await supabase.from("patota").select("id, nome").eq("slug", s).maybeSingle()

    if (!pat) { setLoading(false); return }
    setNomeTime(pat.nome)

    const hoje = new Date().toISOString().split("T")[0]
    const { data: jogos } = await supabase
      .from("jogos")
      .select("id, data, horario, local")
      .eq("patota_id", pat.id)
      .gte("data", hoje)
      .in("status", ["agendado", "confirmado"])
      .order("data")
      .limit(1)

    const proximoJogo = jogos?.[0] ?? null
    setJogo(proximoJogo)

    if (proximoJogo) {
      const { data: salvo } = await supabase
        .from("sorteio_times")
        .select("time_label, nome, rating")
        .eq("jogo_id", proximoJogo.id)
        .order("time_label")

      if (salvo && salvo.length > 0) {
        const mapa = new Map<string, JogadorSorteio[]>()
        for (const r of salvo) {
          const arr = mapa.get(r.time_label) ?? []
          arr.push(r)
          mapa.set(r.time_label, arr)
        }
        setTimes(Array.from(mapa.entries()).map(([label, jogadores]) => ({ label, jogadores })))
      }
    }

    setLoading(false)
  }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>Carregando sorteio...</p>
    </div>
  )

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.voltarBtn} onClick={() => navigate(`/p/${slug}`)}>← Voltar</button>
        <Logo size={48} />
        {nomeTime && <div className={styles.nomeTime}>{nomeTime}</div>}
      </header>

      <main className={styles.main}>
        <div className={styles.titulo}>⚽ Sorteio de times</div>

        {jogo && (
          <div className={styles.jogoInfo}>
            {diaSemana(jogo.data)}, {fmtData(jogo.data)} · {fmtHora(jogo.horario)} · {jogo.local}
          </div>
        )}

        {times.length > 0 ? (
          <div className={styles.timesGrid}>
            {times.map(time => (
              <div key={time.label} className={styles.timeCard}>
                <div className={styles.timeHeader}>
                  <span className={styles.timeLabel}>{time.label}</span>
                  <span className={styles.timeMedia}>⭐ {mediaRating(time.jogadores)}</span>
                </div>
                <ul className={styles.timeList}>
                  {time.jogadores.map((j, i) => (
                    <li key={i} className={styles.timeItem}>
                      <div className={styles.avatar}>{j.nome[0].toUpperCase()}</div>
                      <span>{j.nome}</span>
                      <span className={styles.rating}>{j.rating}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.vazio}>
            <div style={{ fontSize: "2.5rem" }}>🎲</div>
            <p>Sorteio ainda não realizado pelo administrador.</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        PatotaOFC · <a href="/login" className={styles.footerLink}>Área admin</a>
      </footer>
    </div>
  )
}
