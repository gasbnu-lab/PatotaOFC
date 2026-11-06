import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/useAuth"
import Logo from "../components/Logo"
import styles from "./Publica.module.css"

type Patota = {
  id: string
  nome: string
  local_fixo: string | null
  horario_fixo: string | null
  recado: string | null
  logo_url: string | null
}

type Jogo = {
  id: string
  data: string
  horario: string
  local: string
  status: string
  max_jogadores: number | null
  confirmacao_ate: string | null
}

type Presenca = {
  id: string
  jogador_id: string | null
  nome_convidado: string | null
  confirmado: boolean
  convidado: boolean
  aprovado: boolean
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

function fmtDeadlineCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return ""
  const horas = Math.floor(diff / 3600000)
  const min = Math.floor((diff % 3600000) / 60000)
  if (horas < 1) return `Encerra em ${min}min`
  if (horas < 24) return `Encerra em ${horas}h${min > 0 ? min + "min" : ""}`
  const dias = Math.floor(horas / 24)
  return `Encerra em ${dias}d`
}

export default function Publica() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { session, usuario } = useAuth()
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
  const [convidadoNome, setConvidadoNome] = useState("")
  const [adicionandoConvidado, setAdicionandoConvidado] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light")
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  useEffect(() => { if (slug) carregar(slug) }, [slug])

  async function carregar(s: string) {
    setLoading(true)
    const hoje = new Date().toISOString().split("T")[0]

    const isNumeric = /^\d+$/.test(s)
    const patotaQuery = isNumeric
      ? supabase.from("patota").select("id, nome, local_fixo, horario_fixo, recado, logo_url").eq("id", parseInt(s)).maybeSingle()
      : supabase.from("patota").select("id, nome, local_fixo, horario_fixo, recado, logo_url").eq("slug", s).maybeSingle()

    const { data: pat } = await patotaQuery
    if (!pat) { setLoading(false); return }
    const pid = pat.id

    const [{ data: jogos }, { data: jogs }] = await Promise.all([
      supabase.from("jogos").select("*").eq("patota_id", pid).gte("data", hoje).in("status", ["agendado", "confirmado"]).order("data").limit(1),
      supabase.from("jogadores").select("id, nome, email").eq("patota_id", pid).eq("ativo", true).order("nome"),
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
      .eq("patota_id", pid as number)
      .gte("mes_ref", tres.toISOString().slice(0, 7) + "-01")
      .order("mes_ref", { ascending: false })
    setMensalidades(mens ?? [])

    const { data: churr } = await supabase
      .from("churrascos")
      .select("*, churrasco_despesas(valor), churrasco_participantes(id)")
      .eq("patota_id", pid as number)
      .order("data", { ascending: false })
      .limit(1)
    setChrurrascos(churr ?? [])

    setLoading(false)
  }

  // Jogador logado (sessão ativa na patota)
  const sessionEmail = session?.user?.email ?? null
  const jogadorLogado = sessionEmail
    ? jogadores.find(j => j.email?.toLowerCase() === sessionEmail.toLowerCase()) ?? null
    : null

  async function confirmarPresenca(confirmar: boolean) {
    if (!jogo) return
    setLoadingConf(true)

    const emailBusca = jogadorLogado?.email ?? email.trim()

    if (!emailBusca) {
      showToast("Informe seu e-mail para confirmar.")
      setLoadingConf(false)
      return
    }

    const jogador = jogadores.find(j => j.email?.toLowerCase() === emailBusca.toLowerCase())
    if (!jogador) {
      showToast("E-mail não encontrado na patota 🤔")
      setLoadingConf(false)
      return
    }

    const { data: exist } = await supabase
      .from("presencas")
      .select("id")
      .eq("jogo_id", jogo.id)
      .eq("jogador_id", jogador.id)
      .maybeSingle()

    let dbError
    if (exist) {
      const { error } = await supabase.from("presencas").update({ confirmado: confirmar }).eq("id", exist.id)
      dbError = error
    } else {
      const { error } = await supabase.from("presencas").insert({ jogo_id: jogo.id, jogador_id: jogador.id, confirmado: confirmar })
      dbError = error
    }

    if (dbError) {
      showToast(`Erro: ${dbError.message}`)
      setLoadingConf(false)
      return
    }

    // Atualização otimista: reflete imediatamente na UI sem depender da recarga
    setPresencas(prev => {
      const idx = prev.findIndex(p => p.jogador_id === jogador.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], confirmado: confirmar }
        return updated
      }
      return [...prev, {
        id: `temp-${Date.now()}`,
        jogador_id: jogador.id,
        nome_convidado: null,
        confirmado: confirmar,
        convidado: false,
        aprovado: false,
        jogadores: { nome: jogador.nome },
      }]
    })

    // Adicionar convidado — confirmado mas pendente de aprovação pelo admin
    if (confirmar && convidadoNome.trim()) {
      await supabase.from("presencas").insert({
        jogo_id: jogo.id,
        nome_convidado: convidadoNome.trim(),
        convidado: true,
        confirmado: true,
        aprovado: false,
      })
    }

    showToast(confirmar ? rand(FRASES_OK) : rand(FRASES_NAO))
    setEmail("")
    setConvidadoNome("")
    setAdicionandoConvidado(false)
    setConfirmando(false)
    // Sincroniza com o servidor em background para substituir o estado otimista
    if (slug) carregar(slug)
    setLoadingConf(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  // Status de confirmação do jogador logado no jogo atual
  const presencaLogado = jogadorLogado
    ? presencas.find(p => p.jogador_id === jogadorLogado.id) ?? null
    : null

  // Convidados só aparecem na lista pública depois de aprovados pelo admin
  const confirmados = presencas.filter(p => p.confirmado && (!p.convidado || p.aprovado))
  const ausentes = presencas.filter(p => !p.confirmado && !p.convidado)
  const pendentes = jogadores.filter(j => !presencas.some(p => p.jogador_id === j.id))

  function nomePresenca(p: Presenca) {
    return p.jogadores?.nome ?? p.nome_convidado ?? "Convidado"
  }

  const mesAtual = mensalidades.length > 0
    ? [...new Set(mensalidades.map(m => m.mes_ref))].sort().reverse()[0]
    : null
  const mensDoMes = mesAtual ? mensalidades.filter(m => m.mes_ref === mesAtual) : []

  const churrascoAtual = churrascos[0] ?? null
  const totalChurr = churrascoAtual?.churrasco_despesas.reduce((s, d) => s + Number(d.valor), 0) ?? 0

  // Deadline de confirmação
  const confirmacaoEncerrada = jogo?.confirmacao_ate
    ? new Date() > new Date(jogo.confirmacao_ate)
    : false
  const deadlineCountdown = jogo?.confirmacao_ate && !confirmacaoEncerrada
    ? fmtDeadlineCountdown(jogo.confirmacao_ate)
    : null

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
          {patota?.logo_url ? (
            <img src={patota.logo_url} alt={patota.nome} style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 8 }} />
          ) : (
            <Logo size={80} />
          )}
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

        {/* Info da patota */}
        {(patota?.local_fixo || patota?.horario_fixo || patota?.recado) && (
          <div className={styles.card} style={{ background: "var(--accent-bg, #f9fafb)" }}>
            <div className={styles.cardPad}>
              {patota.local_fixo && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                  <span>📍</span>
                  <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{patota.local_fixo}</span>
                </div>
              )}
              {patota.horario_fixo && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                  <span>⏰</span>
                  <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{patota.horario_fixo}</span>
                </div>
              )}
              {patota.recado && (
                <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.8rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: "0.88rem", color: "#92400e" }}>
                  📢 {patota.recado}
                </div>
              )}
            </div>
          </div>
        )}

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
                {deadlineCountdown && (
                  <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "#b45309", background: "#fef3c7", display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: 6 }}>
                    ⏳ {deadlineCountdown}
                  </div>
                )}
                {confirmacaoEncerrada && (
                  <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "#dc2626", background: "#fef2f2", display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: 6 }}>
                    🔒 Confirmações encerradas
                  </div>
                )}
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
              {!confirmacaoEncerrada && (
                <>
                  {/* Logged-in user: direct confirm */}
                  {jogadorLogado && !confirmando ? (
                    <div className={styles.confirmBox} style={{ gap: "0.5rem" }}>
                      <p className={styles.confirmBoxLabel}>
                        Olá, <strong>{jogadorLogado.nome}</strong>!{" "}
                        {presencaLogado != null
                          ? presencaLogado.confirmado
                            ? "✅ Você confirmou presença."
                            : "❌ Você marcou ausência."
                          : "Vai no jogo?"}
                      </p>
                      {adicionandoConvidado && (
                        <input
                          className={styles.emailInput}
                          type="text"
                          placeholder="Nome do convidado"
                          value={convidadoNome}
                          onChange={e => setConvidadoNome(e.target.value)}
                          autoFocus
                        />
                      )}
                      <div className={styles.confirmBtns}>
                        <button
                          className={styles.btnVou}
                          onClick={() => confirmarPresenca(true)}
                          disabled={loadingConf}
                          style={presencaLogado?.confirmado === true ? { outline: "2px solid var(--confirm)" } : undefined}
                        >
                          ✅ Vou!
                        </button>
                        <button
                          className={styles.btnNaoVou}
                          onClick={() => confirmarPresenca(false)}
                          disabled={loadingConf}
                          style={presencaLogado?.confirmado === false ? { outline: "2px solid var(--absent)" } : undefined}
                        >
                          ❌ Não vou
                        </button>
                      </div>
                      <button
                        style={{ background: "none", border: "none", fontSize: "0.78rem", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                        onClick={() => setAdicionandoConvidado(v => !v)}
                      >
                        {adicionandoConvidado ? "Remover convidado" : "+ Levar convidado?"}
                      </button>
                    </div>
                  ) : !confirmando ? (
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
                      {adicionandoConvidado && (
                        <input
                          className={styles.emailInput}
                          style={{ marginTop: "0.5rem" }}
                          type="text"
                          placeholder="Nome do convidado"
                          value={convidadoNome}
                          onChange={e => setConvidadoNome(e.target.value)}
                        />
                      )}
                      <button
                        style={{ background: "none", border: "none", fontSize: "0.78rem", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", padding: "0.25rem 0", alignSelf: "flex-start" }}
                        onClick={() => setAdicionandoConvidado(v => !v)}
                      >
                        {adicionandoConvidado ? "Remover convidado" : "+ Levar convidado?"}
                      </button>
                      <div className={styles.confirmBtns}>
                        <button className={styles.btnVou} onClick={() => confirmarPresenca(true)} disabled={loadingConf}>
                          ✅ Vou!
                        </button>
                        <button className={styles.btnNaoVou} onClick={() => confirmarPresenca(false)} disabled={loadingConf}>
                          ❌ Não vou
                        </button>
                        <button className={styles.btnVoltar} onClick={() => { setConfirmando(false); setEmail(""); setConvidadoNome(""); setAdicionandoConvidado(false) }}>
                          ←
                        </button>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", marginTop: "0.5rem" }}>
                        <a href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>Fazer login</a> para confirmar sem digitar o e-mail
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Lista da semana */}
              <div className={styles.listaSemana}>
                <div className={styles.listaSemanaHeader}>
                  Lista da semana
                  <span className={styles.listaSemanaContagem}>
                    {confirmados.length} confirmados · {ausentes.length} ausentes · {pendentes.length} pendentes
                  </span>
                </div>
                <div className={styles.listaColunas}>
                  <div className={styles.listaGrupo}>
                    <div className={styles.listaGrupoLabel} style={{ color: "var(--confirm)" }}>
                      ✅ Confirmados ({confirmados.length})
                    </div>
                    {confirmados.length === 0 && <div className={styles.listaVazio}>—</div>}
                    {confirmados.map(p => (
                      <div key={p.id} className={styles.listaItem}>
                        <div className={styles.miniAvatar}>{iniciais(nomePresenca(p))}</div>
                        <span>{nomePresenca(p)}{p.convidado && <span className={styles.tagConvidado}>conv.</span>}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.listaGrupo}>
                    <div className={styles.listaGrupoLabel} style={{ color: "var(--absent)" }}>
                      ❌ Ausentes ({ausentes.length})
                    </div>
                    {ausentes.length === 0 && <div className={styles.listaVazio}>—</div>}
                    {ausentes.map(p => (
                      <div key={p.id} className={styles.listaItem} style={{ opacity: 0.6 }}>
                        <div className={styles.miniAvatar}>{iniciais(nomePresenca(p))}</div>
                        {nomePresenca(p)}
                      </div>
                    ))}
                  </div>
                  <div className={styles.listaGrupo}>
                    <div className={styles.listaGrupoLabel} style={{ color: "var(--pending)" }}>
                      ⏳ Pendentes ({pendentes.length})
                    </div>
                    {pendentes.length === 0 && <div className={styles.listaVazio}>—</div>}
                    {pendentes.map(j => (
                      <div key={j.id} className={styles.listaItem} style={{ opacity: 0.5 }}>
                        <div className={styles.miniAvatar}>{iniciais(j.nome)}</div>
                        {j.nome}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
          <div className={styles.card} style={{ cursor: "pointer" }} onClick={() => navigate(`/p/${slug}/sorteio`)}>
            <div className={styles.rowLink}>
              <div className={styles.rowIconBox}>⚽</div>
              <div className={styles.rowTextos}>
                <strong>Sorteio de times</strong>
                <span>Ver times do próximo jogo</span>
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
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/p/${slug}/churrasco/${churrascoAtual.id}`)}
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
        PatotaOFC{usuario?.role === "admin" && <> · <a href="/admin" className={styles.footerLink}>Área admin</a></>}
      </footer>
    </div>
  )
}
