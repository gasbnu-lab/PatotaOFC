import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import Logo from "../components/Logo"
import styles from "./Publica.module.css"

type Patota = { id: string; nome: string }

type Jogo = {
  id: string
  data: string
  horario: string
  local: string
  status: string
  max_jogadores: number | null
}

type Presenca = {
  id: string
  jogador_id: string | null
  nome_convidado: string | null
  confirmado: boolean
  jogadores?: { nome: string } | null
}

type Jogador = { id: string; nome: string; email: string | null }

type Mensalidade = {
  id: string
  jogador_id: string
  mes_ref: string
  pago: boolean
  jogadores?: { nome: string } | null
}

type Churrasco = {
  id: string
  data: string
  descricao: string | null
  churrasco_despesas: { valor: number }[]
  churrasco_participantes: { id: string }[]
}

const FRASES_OK = ["Bora! Tô dentro! 🔥", "Pode contar comigo, cumpade!", "Na veia! Já tô de chuteira!", "Confirmado, campeão!"]
const FRASES_NAO = ["Que pena... semana que vem! 😅", "Faltou gás hoje, mas vou estar lá na próxima!", "Me tirou do time... 😬"]

function rand<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)] }

function statusMens(mes_ref: string, pago: boolean): "pago" | "pendente" | "atrasado" {
  if (pago) return "pago"
  const hoje = new Date()
  const [ano, mes] = mes_ref.split("-").map(Number)
  const venc = new Date(ano, mes - 1, 9)
  return hoje > venc ? "atrasado" : "pendente"
}

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

function mesNome(iso: string) {
  const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
  const mes = parseInt(iso.split("-")[1]) - 1
  return nomes[mes]
}

function iniciais(nome: string) {
  const p = nome.split(" ")
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
}

export default function Publica() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")
  const [patota, setPatota] = useState<Patota | null>(null)
  const [jogo, setJogo] = useState<Jogo | null>(null)
  const [presencas, setPresencas] = useState<Presenca[]>([])
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([])
  const [churrascos, setChrurrascos] = useState<Churrasco[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [email, setEmail] = useState("")
  const [loadingConf, setLoadingConf] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light")
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const hoje = new Date().toISOString().split("T")[0]

    const [{ data: pat }, { data: jogos }, { data: jogs }] = await Promise.all([
      supabase.from("patota").select("id, nome").limit(1).maybeSingle(),
      supabase.from("jogos").select("*").gte("data", hoje).in("status", ["agendado", "confirmado"]).order("data").limit(1),
      supabase.from("jogadores").select("id, nome, email").eq("ativo", true).order("nome"),
    ])

    setPatota(pat ?? null)
    setJogadores(jogs ?? [])

    const proximoJogo = jogos?.[0] ?? null
    setJogo(proximoJogo)

    if (proximoJogo) {
      const { data: p } = await supabase.from("presencas").select("*, jogadores(nome)").eq("jogo_id", proximoJogo.id)
      setPresencas(p ?? [])
    }

    const tres = new Date()
    tres.setMonth(tres.getMonth() - 2)
    const { data: mens } = await supabase
      .from("mensalidades")
      .select("*, jogadores(nome)")
      .gte("mes_ref", tres.toISOString().slice(0, 7) + "-01")
      .order("mes_ref", { ascending: false })
    setMensalidades(mens ?? [])

    const { data: churr } = await supabase
      .from("churrascos")
      .select("*, churrasco_despesas(valor), churrasco_participantes(id)")
      .order("data", { ascending: false })
      .limit(1)
    setChrurrascos(churr ?? [])

    setLoading(false)
  }

  async function confirmarPresenca(confirmar: boolean) {
    if (!jogo || !email.trim()) return
    setLoadingConf(true)
    const jogador = jogadores.find(j => j.email?.toLowerCase() === email.toLowerCase().trim())
    if (!jogador) {
      showToast("E-mail não encontrado na patota 🤔")
      setLoadingConf(false)
      return
    }
    const { data: exist } = await supabase.from("presencas").select("id").eq("jogo_id", jogo.id).eq("jogador_id", jogador.id).maybeSingle()
    if (exist) {
      await supabase.from("presencas").update({ confirmado: confirmar }).eq("id", exist.id)
    } else {
      await supabase.from("presencas").insert({ jogo_id: jogo.id, jogador_id: jogador.id, confirmado: confirmar })
    }
    showToast(confirmar ? rand(FRASES_OK) : rand(FRASES_NAO))
    setEmail("")
    setConfirmando(false)
    await carregar()
    setLoadingConf(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  const confirmados = presencas.filter(p => p.confirmado)
  const ausentes = presencas.filter(p => !p.confirmado)
  const pendentes = jogadores.filter(j => !presencas.some(p => p.jogador_id === j.id))

  function nomePresenca(p: Presenca) {
    return p.jogadores?.nome ?? p.nome_convidado ?? "Convidado"
  }

  // Mensalidades: só o mês mais recente
  const mesAtual = mensalidades.length > 0
    ? [...new Set(mensalidades.map(m => m.mes_ref))].sort().reverse()[0]
    : null

  const mensDoMes = mesAtual ? mensalidades.filter(m => m.mes_ref === mesAtual) : []

  const churrascoAtual = churrascos[0] ?? null
  const totalChurr = churrascoAtual?.churrasco_despesas.reduce((s, d) => s + Number(d.valor), 0) ?? 0

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Carregando a patota...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo size={80} />
          <div className={styles.headerTextos}>
            <div className={styles.nomeTime}>{patota?.nome ?? ""}</div>
          </div>
          <div className={styles.headerAcoes}>
            <button
              className={styles.darkBtn}
              onClick={() => setDark(v => !v)}
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>

        {/* Próximo jogo */}
        <div className={styles.card}>
          {jogo ? (
            <>
              <div className={styles.jogoBanner}>
                <div className={styles.jogoBannerLabel}>Próximo jogo</div>
                <div className={styles.jogoDataHora}>
                  {diaSemana(jogo.data)}, {fmtData(jogo.data)} · {fmtHora(jogo.horario)}
                </div>
                <div className={styles.jogoLocal}>📍 {jogo.local}</div>
              </div>

              {/* Stats */}
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <div className={styles.statNum} style={{ color: "var(--confirm)" }}>{confirmados.length}</div>
                  <div className={styles.statLabel}>Confirmados</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statNum} style={{ color: "var(--absent)" }}>{ausentes.length}</div>
                  <div className={styles.statLabel}>Ausentes</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statNum} style={{ color: "var(--pending)" }}>{pendentes.length}</div>
                  <div className={styles.statLabel}>Pendentes</div>
                </div>
              </div>

              {/* Botão confirmar */}
              {!confirmando ? (
                <button className={styles.confirmBtn} onClick={() => setConfirmando(true)}>
                  <div className={styles.confirmIconBox}>✅</div>
                  <div className={styles.confirmTextos}>
                    <strong>Confirmar presença</strong>
                    <span>Toque para responder</span>
                  </div>
                  <span className={styles.chevron}>›</span>
                </button>
              ) : (
                <div className={styles.confirmBox}>
                  <p className={styles.confirmBoxLabel}>Qual é o seu e-mail cadastrado?</p>
                  <input
                    className={styles.emailInput}
                    type="email"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && confirmarPresenca(true)}
                    autoFocus
                  />
                  <div className={styles.confirmBtns}>
                    <button className={styles.btnVou} onClick={() => confirmarPresenca(true)} disabled={loadingConf}>
                      ✅ Vou!
                    </button>
                    <button className={styles.btnNaoVou} onClick={() => confirmarPresenca(false)} disabled={loadingConf}>
                      ❌ Não vou
                    </button>
                    <button className={styles.btnVoltar} onClick={() => { setConfirmando(false); setEmail("") }}>
                      ←
                    </button>
                  </div>
                </div>
              )}

              {/* Lista */}
              {(confirmados.length > 0 || ausentes.length > 0) && (
                <div className={styles.presencaListas}>
                  {confirmados.length > 0 && (
                    <div className={styles.listaGrupo}>
                      <div className={styles.listaGrupoLabel} style={{ color: "var(--confirm)" }}>
                        ✅ Confirmados ({confirmados.length})
                      </div>
                      {confirmados.map(p => (
                        <div key={p.id} className={styles.listaItem}>
                          <div className={styles.miniAvatar}>{iniciais(nomePresenca(p))}</div>
                          {nomePresenca(p)}
                        </div>
                      ))}
                    </div>
                  )}
                  {ausentes.length > 0 && (
                    <div className={styles.listaGrupo}>
                      <div className={styles.listaGrupoLabel} style={{ color: "var(--absent)" }}>
                        ❌ Não vão ({ausentes.length})
                      </div>
                      {ausentes.map(p => (
                        <div key={p.id} className={styles.listaItem} style={{ opacity: 0.6 }}>
                          <div className={styles.miniAvatar}>{iniciais(nomePresenca(p))}</div>
                          {nomePresenca(p)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={styles.cardPad}>
              <div className={styles.secLabel}>Próximo jogo</div>
              <p className={styles.jogoVazio}>Nenhum jogo agendado ainda. 😴</p>
            </div>
          )}
        </div>

        {/* Sorteio */}
        {jogo && (
          <div className={styles.card}>
            <div className={styles.rowLink}>
              <div className={styles.rowIconBox}>⚽</div>
              <div className={styles.rowTextos}>
                <strong>Sorteio de times</strong>
                <span>Ver times do sábado</span>
              </div>
              <span className={styles.chevron}>›</span>
            </div>
          </div>
        )}

        {/* Mensalidades */}
        {mensDoMes.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardPad} style={{ paddingBottom: "0.5rem" }}>
              <div className={styles.secLabel}>Mensalidades · {mesNome(mesAtual!)}/{mesAtual!.split("-")[0]}</div>
            </div>
            {mensDoMes.map(m => {
              const st = statusMens(m.mes_ref, m.pago)
              return (
                <div key={m.id} className={styles.mensRow}>
                  <div className={styles.mensAvatar}>{iniciais(m.jogadores?.nome ?? "?")}</div>
                  <span className={styles.mensNome}>{m.jogadores?.nome ?? "—"}</span>
                  <span className={`${styles.badge} ${styles[`badge${st.charAt(0).toUpperCase() + st.slice(1)}`]}`}>
                    {st === "pago" ? "PAGO" : st === "atrasado" ? "ATRASADO" : "PENDENTE"}
                  </span>
                </div>
              )
            })}
            <div className={styles.mensLegenda}>Vencimento: todo dia 9</div>
          </div>
        )}

        {/* Churrasco */}
        {churrascoAtual && (
          <div
            className={styles.churrCard}
            onClick={() => {/* futuro: navegar para página pública de churrasco */}}
          >
            <span style={{ fontSize: "1.5rem" }}>🥩</span>
            <div className={styles.churrTextos}>
              <strong>Churrasco do mês</strong>
              <span>
                {fmtData(churrascoAtual.data)} · R$ {totalChurr.toFixed(2)} · {churrascoAtual.churrasco_participantes.length} pessoas
              </span>
            </div>
            <span style={{ marginLeft: "auto", color: "rgba(0,0,0,0.5)", fontSize: "0.85rem" }}>›</span>
          </div>
        )}

      </main>

      <footer className={styles.footer}>
        PatotaOFC · <a href="/login" className={styles.footerLink}>Área admin</a>
      </footer>
    </div>
  )
}
