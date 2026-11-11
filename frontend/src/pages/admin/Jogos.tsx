import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../lib/useAuth"
import s from "./admin.module.css"

type Jogo = {
  id: string
  data: string
  horario: string
  local: string
  status: string
  max_jogadores: number | null
  confirmacao_ate: string | null
}

type ConvidadoPendente = {
  id: string
  jogo_id: string
  nome_convidado: string
}

type Participante = {
  key: string
  nome: string
  jogador_id: string | null
  presenca_id: string | null
}

type Estat = { gols: number; assistencias: number; gols_sofridos: number; canetas: number }

type Form = {
  data: string
  horario: string
  local: string
  max_jogadores: string
  status: string
  confirmacao_ate: string
}

const FORM_VAZIO: Form = {
  data: "",
  horario: "10:00",
  local: "",
  max_jogadores: "14",
  status: "agendado",
  confirmacao_ate: "",
}

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
}

function isoParaDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  // "2026-11-10T14:00:00+00:00" → "2026-11-10T14:00"
  return iso.slice(0, 16)
}

export default function Jogos() {
  const { usuario } = useAuth()
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Jogo | null>(null)
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [convidadosPendentes, setConvidadosPendentes] = useState<ConvidadoPendente[]>([])

  // Modal de estatísticas
  const [modalEstat, setModalEstat] = useState<Jogo | null>(null)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [estats, setEstats] = useState<Record<string, Estat>>({})
  const [salvandoEstat, setSalvandoEstat] = useState(false)

  // Modal recorrente
  const [modalRec, setModalRec] = useState(false)
  const [recDiaSemana, setRecDiaSemana] = useState("1") // 0=dom..6=sab, default segunda
  const [recHorario, setRecHorario] = useState("20:00")
  const [recLocal, setRecLocal] = useState("")
  const [recMes, setRecMes] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`
  })
  const [recMaxJogadores, setRecMaxJogadores] = useState("14")
  const [gerandoRec, setGerandoRec] = useState(false)
  const [msgRec, setMsgRec] = useState<string | null>(null)

  useEffect(() => {
    if (usuario?.patota_id) {
      carregar(usuario.patota_id)
      carregarConvidados(usuario.patota_id)
    }
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase
      .from("jogos")
      .select("*")
      .eq("patota_id", patotatId)
      .order("data", { ascending: true })
    setJogos(data ?? [])
    setLoading(false)
  }

  async function carregarConvidados(patotatId: number) {
    // Pega convidados pendentes de aprovação dos próximos jogos
    const hoje = new Date().toISOString().split("T")[0]
    const { data: jogosRecentes } = await supabase
      .from("jogos")
      .select("id")
      .eq("patota_id", patotatId)
      .gte("data", hoje)
    const jogoIds = (jogosRecentes ?? []).map(j => j.id)
    if (jogoIds.length === 0) { setConvidadosPendentes([]); return }
    const { data } = await supabase
      .from("presencas")
      .select("id, jogo_id, nome_convidado")
      .in("jogo_id", jogoIds)
      .eq("convidado", true)
      .eq("aprovado", false)
    setConvidadosPendentes((data ?? []).filter(d => d.nome_convidado) as ConvidadoPendente[])
  }

  async function aprovarConvidado(id: string) {
    await supabase.from("presencas").update({ aprovado: true }).eq("id", id)
    if (usuario?.patota_id) await carregarConvidados(usuario.patota_id)
  }

  async function rejeitarConvidado(id: string) {
    await supabase.from("presencas").delete().eq("id", id)
    if (usuario?.patota_id) await carregarConvidados(usuario.patota_id)
  }

  async function gerarRecorrente() {
    if (!recMes || !recLocal.trim() || !usuario?.patota_id) return
    setGerandoRec(true)
    setMsgRec(null)

    const [ano, mes] = recMes.split("-").map(Number)
    const diaSemana = parseInt(recDiaSemana)

    // Encontra todas as datas do dia da semana no mês
    const datas: string[] = []
    const ultimoDia = new Date(ano, mes, 0).getDate()
    for (let d = 1; d <= ultimoDia; d++) {
      const dt = new Date(ano, mes - 1, d)
      if (dt.getDay() === diaSemana) {
        datas.push(`${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
      }
    }

    // Ignora datas no passado
    const hoje = new Date().toISOString().split("T")[0]
    const datasFuturas = datas.filter(d => d >= hoje)

    if (datasFuturas.length === 0) {
      setMsgRec("Nenhuma data futura encontrada para este período.")
      setGerandoRec(false)
      return
    }

    // Verifica quais já existem (mesmo dia e horário)
    const { data: existentes } = await supabase
      .from("jogos")
      .select("data, horario")
      .eq("patota_id", usuario.patota_id)
      .in("data", datasFuturas)
    const existentesSet = new Set(
      (existentes ?? []).map(e => `${e.data}|${e.horario}`)
    )
    const novas = datasFuturas.filter(d => !existentesSet.has(`${d}|${recHorario}`))

    if (novas.length === 0) {
      setMsgRec("Todos os jogos deste período já estão cadastrados.")
      setGerandoRec(false)
      return
    }

    const rows = novas.map(data => ({
      data,
      horario: recHorario,
      local: recLocal.trim(),
      max_jogadores: recMaxJogadores ? parseInt(recMaxJogadores) : null,
      status: "agendado",
      patota_id: usuario!.patota_id,
    }))

    const { error } = await supabase.from("jogos").insert(rows)
    if (error) {
      setMsgRec(`Erro: ${error.message}`)
    } else {
      setMsgRec(`${novas.length} jogo(s) criado(s)!`)
      await carregar(usuario.patota_id)
    }
    setGerandoRec(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModal(true)
  }

  function abrirEditar(j: Jogo) {
    setEditando(j)
    setForm({
      data: j.data,
      horario: j.horario.slice(0, 5),
      local: j.local,
      max_jogadores: j.max_jogadores ? String(j.max_jogadores) : "",
      status: j.status,
      confirmacao_ate: isoParaDatetimeLocal(j.confirmacao_ate),
    })
    setModal(true)
  }

  async function salvar() {
    if (!form.data || !form.local.trim() || !usuario?.patota_id) return
    setSalvando(true)
    const payload = {
      data: form.data,
      horario: form.horario,
      local: form.local.trim(),
      max_jogadores: form.max_jogadores ? parseInt(form.max_jogadores) : null,
      status: form.status,
      confirmacao_ate: form.confirmacao_ate ? new Date(form.confirmacao_ate).toISOString() : null,
    }
    if (editando) {
      await supabase.from("jogos").update(payload).eq("id", editando.id)
    } else {
      await supabase.from("jogos").insert({ ...payload, patota_id: usuario.patota_id })
    }
    setModal(false)
    setEditando(null)
    setForm(FORM_VAZIO)
    setSalvando(false)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function excluir(id: string) {
    await supabase.from("jogos").delete().eq("id", id)
    setConfirmDelId(null)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function abrirEstat(j: Jogo) {
    setModalEstat(j)
    setParticipantes([])
    setEstats({})

    // Carrega confirmados (jogadores + convidados aprovados)
    const { data: pres } = await supabase
      .from("presencas")
      .select("id, jogador_id, nome_convidado, convidado, aprovado, jogadores(nome)")
      .eq("jogo_id", j.id)
      .eq("confirmado", true)

    const lista: Participante[] = []
    for (const p of pres ?? []) {
      if (!p.convidado || p.convidado === false) {
        if (p.jogador_id) {
          lista.push({
            key: `j_${p.jogador_id}`,
            nome: (p.jogadores as any)?.nome ?? "?",
            jogador_id: p.jogador_id,
            presenca_id: null,
          })
        }
      } else if (p.aprovado) {
        lista.push({
          key: `c_${p.id}`,
          nome: p.nome_convidado ?? "Convidado",
          jogador_id: null,
          presenca_id: p.id,
        })
      }
    }
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    setParticipantes(lista)

    // Carrega estatísticas existentes
    const jogIds = lista.filter(p => p.jogador_id).map(p => p.jogador_id!)
    const presIds = lista.filter(p => p.presenca_id).map(p => p.presenca_id!)
    const mapaEstat: Record<string, Estat> = {}
    if (jogIds.length > 0) {
      const { data: ejogs } = await supabase.from("jogo_estatisticas").select("*").eq("jogo_id", j.id).in("jogador_id", jogIds)
      for (const e of ejogs ?? []) {
        mapaEstat[`j_${e.jogador_id}`] = { gols: e.gols, assistencias: e.assistencias, gols_sofridos: e.gols_sofridos, canetas: e.canetas ?? 0 }
      }
    }
    if (presIds.length > 0) {
      const { data: epres } = await supabase.from("jogo_estatisticas").select("*").eq("jogo_id", j.id).in("presenca_id", presIds)
      for (const e of epres ?? []) {
        mapaEstat[`c_${e.presenca_id}`] = { gols: e.gols, assistencias: e.assistencias, gols_sofridos: e.gols_sofridos, canetas: e.canetas ?? 0 }
      }
    }
    setEstats(mapaEstat)
  }

  async function salvarEstat() {
    if (!modalEstat) return
    setSalvandoEstat(true)
    for (const p of participantes) {
      const e = estats[p.key] ?? { gols: 0, assistencias: 0, gols_sofridos: 0, canetas: 0 }
      const payload = {
        jogo_id: modalEstat.id,
        jogador_id: p.jogador_id,
        presenca_id: p.presenca_id,
        gols: e.gols,
        assistencias: e.assistencias,
        gols_sofridos: e.gols_sofridos,
        canetas: e.canetas,
      }
      if (p.jogador_id) {
        await supabase.from("jogo_estatisticas").upsert(payload, { onConflict: "jogo_id,jogador_id" })
      } else {
        await supabase.from("jogo_estatisticas").upsert(payload, { onConflict: "jogo_id,presenca_id" })
      }
    }
    setSalvandoEstat(false)
    setModalEstat(null)
  }

  function setEstatField(key: string, field: keyof Estat, val: number) {
    setEstats(prev => ({ ...prev, [key]: { ...(prev[key] ?? { gols: 0, assistencias: 0, gols_sofridos: 0, canetas: 0 }), [field]: val } }))
  }

  function fmtData(iso: string) {
    const [a, m, d] = iso.split("-")
    return `${d}/${m}/${a}`
  }

  function fmtDeadline(iso: string | null) {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  }

  if (loading) return <div className={s.page}><div className={s.empty}>Carregando...</div></div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Jogos</h1>
          <div className={s.pageSubtitulo}>{jogos.length} no total</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={s.btnSecondary} onClick={() => { setModalRec(true); setMsgRec(null) }}>⟳ Recorrente</button>
          <button className={s.btnPrimary} onClick={abrirNovo}>+ Novo jogo</button>
        </div>
      </div>

      <div className={s.card}>
        {jogos.length === 0 ? (
          <div className={s.empty}>Nenhum jogo cadastrado ainda.</div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Local</th>
                <th>Conf. até</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jogos.map(j => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>{fmtData(j.data)}</td>
                  <td>{j.horario.slice(0, 5)}</td>
                  <td>{j.local}</td>
                  <td style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {fmtDeadline(j.confirmacao_ate) ?? "—"}
                  </td>
                  <td>
                    <span className={s[`badge${j.status.charAt(0).toUpperCase() + j.status.slice(1)}`] || s.badgeAgendado}>
                      {STATUS_LABEL[j.status] ?? j.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      <button className={s.btnSecondary} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }} onClick={() => abrirEditar(j)}>
                        Editar
                      </button>
                      {j.data < new Date().toISOString().split("T")[0] && (
                        <button className={s.btnSecondary} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }} onClick={() => abrirEstat(j)}>
                          📊 Stats
                        </button>
                      )}
                      {confirmDelId === j.id ? (
                        <>
                          <button onClick={() => excluir(j.id)} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
                            Confirmar exclusão
                          </button>
                          <button className={s.btnSecondary} style={{ padding: "0.3rem 0.5rem", fontSize: "0.78rem" }} onClick={() => setConfirmDelId(null)}>✕</button>
                        </>
                      ) : (
                        <button className={s.btnSecondary} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", color: "#dc2626" }} onClick={() => setConfirmDelId(j.id)}>
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Convidados pendentes de aprovação */}
      {convidadosPendentes.length > 0 && (
        <div className={s.card} style={{ marginBottom: "1rem" }}>
          <div className={s.cardPad} style={{ paddingBottom: "0.5rem" }}>
            <div className={s.cardTitulo}>Convidados pendentes de aprovação</div>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Jogo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {convidadosPendentes.map(c => {
                const jogo = jogos.find(j => j.id === c.jogo_id)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>{c.nome_convidado}</td>
                    <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      {jogo ? fmtData(jogo.data) : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                        <button
                          className={s.btnPrimary}
                          style={{ padding: "0.3rem 0.8rem", fontSize: "0.78rem" }}
                          onClick={() => aprovarConvidado(c.id)}
                        >
                          ✓ Aprovar
                        </button>
                        <button
                          className={s.btnSecondary}
                          style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", color: "#dc2626" }}
                          onClick={() => rejeitarConvidado(c.id)}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal gerar jogos recorrentes */}
      {modalRec && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModalRec(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>Gerar jogos recorrentes</span>
              <button className={s.modalClose} onClick={() => setModalRec(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.formGrid}>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Dia da semana</label>
                  <select className={s.formSelect} value={recDiaSemana} onChange={e => setRecDiaSemana(e.target.value)}>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda-feira</option>
                    <option value="2">Terça-feira</option>
                    <option value="3">Quarta-feira</option>
                    <option value="4">Quinta-feira</option>
                    <option value="5">Sexta-feira</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Horário</label>
                  <input className={s.formInput} type="time" value={recHorario} onChange={e => setRecHorario(e.target.value)} />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Mês</label>
                  <input className={s.formInput} type="month" value={recMes} onChange={e => setRecMes(e.target.value)} />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Máx. jogadores</label>
                  <input className={s.formInput} type="number" value={recMaxJogadores} onChange={e => setRecMaxJogadores(e.target.value)} />
                </div>
                <div className={`${s.formGroup} ${s.full}`}>
                  <label className={s.formLabel}>Local *</label>
                  <input className={s.formInput} value={recLocal} onChange={e => setRecLocal(e.target.value)} placeholder="Arena Show de Bola" />
                </div>
              </div>
              {msgRec && (
                <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.9rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, fontSize: "0.85rem", color: "#166534" }}>
                  {msgRec}
                </div>
              )}
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModalRec(false)}>Fechar</button>
              <button className={s.btnPrimary} onClick={gerarRecorrente} disabled={gerandoRec || !recLocal.trim()}>
                {gerandoRec ? "Gerando..." : "Gerar jogos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal estatísticas */}
      {modalEstat && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModalEstat(null)}>
          <div className={s.modal} style={{ maxWidth: 560 }}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>📊 Estatísticas — {fmtData(modalEstat.data)}</span>
              <button className={s.modalClose} onClick={() => setModalEstat(null)}>✕</button>
            </div>
            <div className={s.modalBody}>
              {participantes.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Nenhum jogador confirmado neste jogo.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase" }}>
                      <th style={{ textAlign: "left", padding: "0 0 0.5rem 0", fontWeight: 600 }}>Jogador</th>
                      <th style={{ textAlign: "center", padding: "0 0 0.5rem 0.4rem", fontWeight: 600 }}>⚽ Gols</th>
                      <th style={{ textAlign: "center", padding: "0 0 0.5rem 0.4rem", fontWeight: 600 }}>🅰️ Assist.</th>
                      <th style={{ textAlign: "center", padding: "0 0 0.5rem 0.4rem", fontWeight: 600 }}>🛡️ Sofridos</th>
                      <th style={{ textAlign: "center", padding: "0 0 0.5rem 0.4rem", fontWeight: 600 }}>🥤 Canetas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantes.map(p => {
                      const e = estats[p.key] ?? { gols: 0, assistencias: 0, gols_sofridos: 0, canetas: 0 }
                      return (
                        <tr key={p.key} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.4rem 0", fontWeight: 500, color: "var(--text)" }}>
                            {p.nome}
                            {p.presenca_id && <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: 4 }}>(conv.)</span>}
                          </td>
                          {(["gols", "assistencias", "gols_sofridos", "canetas"] as const).map(field => (
                            <td key={field} style={{ textAlign: "center", padding: "0.4rem 0.4rem" }}>
                              <input
                                type="number"
                                min={0}
                                value={e[field]}
                                onChange={ev => setEstatField(p.key, field, Math.max(0, parseInt(ev.target.value) || 0))}
                                style={{ width: 52, textAlign: "center", padding: "0.25rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.85rem" }}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModalEstat(null)}>Fechar</button>
              <button className={s.btnPrimary} onClick={salvarEstat} disabled={salvandoEstat || participantes.length === 0}>
                {salvandoEstat ? "Salvando..." : "Salvar estatísticas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>{editando ? "Editar jogo" : "Novo jogo"}</span>
              <button className={s.modalClose} onClick={() => setModal(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.formGrid}>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Data *</label>
                  <input className={s.formInput} type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Horário</label>
                  <input className={s.formInput} type="time" value={form.horario} onChange={e => setForm(f => ({...f, horario: e.target.value}))} />
                </div>
                <div className={`${s.formGroup} ${s.full}`}>
                  <label className={s.formLabel}>Local *</label>
                  <input className={s.formInput} value={form.local} onChange={e => setForm(f => ({...f, local: e.target.value}))} placeholder="Arena Show de Bola" />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Máx. jogadores</label>
                  <input className={s.formInput} type="number" value={form.max_jogadores} onChange={e => setForm(f => ({...f, max_jogadores: e.target.value}))} />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Status</label>
                  <select className={s.formSelect} value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="realizado">Realizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div className={`${s.formGroup} ${s.full}`}>
                  <label className={s.formLabel}>Confirmações encerram em</label>
                  <input
                    className={s.formInput}
                    type="datetime-local"
                    value={form.confirmacao_ate}
                    onChange={e => setForm(f => ({...f, confirmacao_ate: e.target.value}))}
                  />
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    Após esta data/hora, confirmações serão bloqueadas na página pública.
                  </div>
                </div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModal(false)}>Cancelar</button>
              <button className={s.btnPrimary} onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar jogo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
