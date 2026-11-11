import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import type { Usuario } from "../../lib/useAuth"
import s from "./admin.module.css"
import f from "./Financeiro.module.css"

type Ctx = { usuario: Usuario; nomeTime: string }

type JogadorPlano = { id: string; nome: string; plano_mensalidade: "com_churrasco" | "sem_churrasco" | null }

type Churrasco = {
  id: string
  data: string
  descricao: string | null
  criado_em: string
  encerrado_em: string | null
}

type Despesa = {
  id: string
  descricao: string
  valor: number
  pago_por_id: string | null
  pago_por_nome?: string
}

type Participante = {
  id: string
  jogador_id: string | null
  nome_avulso: string | null
  nome: string
  valor_devido: number
  status: "pendente" | "pago" | "atrasado"
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  const [a, m, d] = iso.split("-")
  return `${d}/${m}/${a}`
}

const statusLabel: Record<string, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" }
const statusColor: Record<string, string> = { pendente: "#d97706", pago: "#16a34a", atrasado: "#dc2626" }

export default function Churrascos() {
  const { usuario } = useOutletContext<Ctx>()
  const [loading, setLoading] = useState(true)
  const [churrascos, setChurrascos] = useState<Churrasco[]>([])
  const [detalhe, setDetalhe] = useState<Churrasco | null>(null)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [valorAdicional, setValorAdicional] = useState(15)
  const [jogadoresPlano, setJogadoresPlano] = useState<JogadorPlano[]>([])

  // form novo churrasco
  const [formNovo, setFormNovo] = useState(false)
  const [fData, setFData] = useState(new Date().toISOString().split("T")[0])
  const [fDesc, setFDesc] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // editar churrasco
  const [editando, setEditando] = useState<Churrasco | null>(null)
  const [eData, setEData] = useState("")
  const [eDesc, setEDesc] = useState("")
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  // excluir churrasco
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // form nova despesa
  const [formDespesa, setFormDespesa] = useState(false)
  const [dDesc, setDDesc] = useState("")
  const [dValor, setDValor] = useState("")
  const [salvandoDespesa, setSalvandoDespesa] = useState(false)
  const [erroDespesa, setErroDespesa] = useState<string | null>(null)

  const [encerrando, setEncerrando] = useState(false)
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null)

  // form participante: modo jogador ou avulso
  const [formPartic, setFormPartic] = useState(false)
  const [pModo, setPModo] = useState<"jogador" | "avulso">("jogador")
  const [pJogadorId, setPJogadorId] = useState("")
  const [pNome, setPNome] = useState("")
  const [salvandoPartic, setSalvandoPartic] = useState(false)

  useEffect(() => { carregarLista(); carregarConfig() }, [])

  async function carregarLista() {
    setLoading(true)
    const { data } = await supabase
      .from("churrascos")
      .select("id, data, descricao, criado_em, encerrado_em")
      .eq("patota_id", usuario.patota_id)
      .order("data", { ascending: false })
    setChurrascos(data ?? [])
    setLoading(false)
  }

  async function carregarConfig() {
    const { data } = await supabase
      .from("patota")
      .select("valor_adicional_churrasco")
      .eq("id", usuario.patota_id)
      .maybeSingle()
    if (data) setValorAdicional(data.valor_adicional_churrasco ?? 15)
    const { data: jogs } = await supabase
      .from("jogadores")
      .select("id, nome, plano_mensalidade")
      .eq("patota_id", usuario.patota_id)
      .eq("ativo", true)
      .order("nome")
    setJogadoresPlano((jogs ?? []) as JogadorPlano[])
    if (jogs && jogs.length > 0) setPJogadorId(jogs[0].id)
  }

  async function abrirDetalhe(c: Churrasco) {
    setDetalhe(c)
    setFormDespesa(false)
    setFormPartic(false)
    setLoadingDetalhe(true)
    await carregarDetalhe(c.id)
    setLoadingDetalhe(false)
  }

  async function carregarDetalhe(cid: string) {
    const [{ data: desp }, { data: part }] = await Promise.all([
      supabase
        .from("churrasco_despesas")
        .select("id, descricao, valor, pago_por_id, jogadores(nome)")
        .eq("churrasco_id", cid)
        .order("criado_em"),
      supabase
        .from("churrasco_participantes")
        .select("id, jogador_id, nome_avulso, valor_devido, status, jogadores(nome)")
        .eq("churrasco_id", cid)
        .order("criado_em"),
    ])

    setDespesas(
      (desp ?? []).map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        valor: Number(d.valor),
        pago_por_id: d.pago_por_id,
        pago_por_nome: d.jogadores?.nome,
      }))
    )

    setParticipantes(
      (part ?? []).map((p: any) => ({
        id: p.id,
        jogador_id: p.jogador_id,
        nome_avulso: p.nome_avulso,
        nome: p.jogadores?.nome ?? p.nome_avulso ?? "?",
        valor_devido: Number(p.valor_devido),
        status: p.status,
      }))
    )
  }

  async function criarChurrasco(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!fData) { setErro("Data obrigatória."); return }
    setSalvando(true)
    const { data, error } = await supabase
      .from("churrascos")
      .insert({ data: fData, descricao: fDesc.trim() || null, patota_id: usuario.patota_id })
      .select("id, data, descricao, criado_em, encerrado_em")
      .single()
    setSalvando(false)
    if (error) { setErro(`Erro: ${error.message}`); return }
    setFormNovo(false)
    setFData(new Date().toISOString().split("T")[0])
    setFDesc("")
    await carregarLista()
    if (data) abrirDetalhe(data)
  }

  async function adicionarDespesa(e: React.FormEvent) {
    e.preventDefault()
    if (!detalhe) return
    setErroDespesa(null)
    const valor = parseFloat(dValor.replace(",", "."))
    if (isNaN(valor) || valor <= 0) { setErroDespesa("Valor inválido."); return }
    if (!dDesc.trim()) { setErroDespesa("Descrição obrigatória."); return }
    setSalvandoDespesa(true)
    const { error } = await supabase.from("churrasco_despesas").insert({
      churrasco_id: detalhe.id,
      descricao: dDesc.trim(),
      valor,
    })
    setSalvandoDespesa(false)
    if (error) { setErroDespesa(`Erro: ${error.message}`); return }
    setFormDespesa(false)
    setDDesc(""); setDValor("")
    await carregarDetalhe(detalhe.id)
  }

  async function deletarDespesa(id: string) {
    if (!detalhe) return
    await supabase.from("churrasco_despesas").delete().eq("id", id)
    await carregarDetalhe(detalhe.id)
  }

  function valorParaParticipante(jogadorId: string | null): number {
    if (!jogadorId) return valorAdicional
    const jog = jogadoresPlano.find(j => j.id === jogadorId)
    if (jog?.plano_mensalidade === "com_churrasco") return 0
    return valorAdicional
  }

  async function adicionarParticipante(e: React.FormEvent) {
    e.preventDefault()
    if (!detalhe) return
    setSalvandoPartic(true)
    if (pModo === "jogador" && pJogadorId) {
      const jog = jogadoresPlano.find(j => j.id === pJogadorId)
      const jaExiste = participantes.some(p => p.jogador_id === pJogadorId)
      if (!jaExiste) {
        await supabase.from("churrasco_participantes").insert({
          churrasco_id: detalhe.id,
          jogador_id: pJogadorId,
          nome_avulso: null,
          valor_devido: valorParaParticipante(pJogadorId),
          status: "pendente",
        })
      }
    } else if (pModo === "avulso" && pNome.trim()) {
      await supabase.from("churrasco_participantes").insert({
        churrasco_id: detalhe.id,
        jogador_id: null,
        nome_avulso: pNome.trim(),
        valor_devido: valorAdicional,
        status: "pendente",
      })
    }
    setSalvandoPartic(false)
    setFormPartic(false)
    setPNome("")
    await carregarDetalhe(detalhe.id)
  }

  async function removerParticipante(id: string) {
    if (!detalhe) return
    await supabase.from("churrasco_participantes").delete().eq("id", id)
    await carregarDetalhe(detalhe.id)
  }

  async function alterarStatus(pid: string, status: "pendente" | "pago" | "atrasado") {
    if (!detalhe) return
    await supabase.from("churrasco_participantes").update({ status }).eq("id", pid)
    await carregarDetalhe(detalhe.id)
  }

  async function encerrarChurrasco() {
    if (!detalhe) return
    setErroEncerrar(null)
    setEncerrando(true)

    // Idempotência: verificar se já foi encerrado
    const { data: churr } = await supabase.from("churrascos").select("encerrado_em").eq("id", detalhe.id).single()
    if (churr?.encerrado_em) {
      setErroEncerrar("Este churrasco já foi encerrado.")
      setEncerrando(false)
      return
    }

    // Lançar saídas para cada despesa
    for (const d of despesas) {
      await supabase.from("lancamentos").insert({
        tipo: "saida",
        valor: d.valor,
        descricao: `Churrasco ${fmtData(detalhe.data)} — ${d.descricao}`,
        data: detalhe.data,
        patota_id: usuario.patota_id,
        referencia_tipo: "churrasco_despesa",
        referencia_id: d.id,
      })
    }

    // Lançar entradas para cada participante pago
    for (const p of participantes.filter(p => p.status === "pago" && p.valor_devido > 0)) {
      await supabase.from("lancamentos").insert({
        tipo: "entrada",
        valor: p.valor_devido,
        descricao: `Churrasco ${fmtData(detalhe.data)} — ${p.nome}`,
        data: detalhe.data,
        patota_id: usuario.patota_id,
        referencia_tipo: "churrasco_participante",
        referencia_id: p.id,
      })
    }

    // Marcar como encerrado
    await supabase.from("churrascos").update({ encerrado_em: new Date().toISOString() }).eq("id", detalhe.id)

    setDetalhe(prev => prev ? { ...prev, encerrado_em: new Date().toISOString() } : prev)
    setEncerrando(false)
    await carregarLista()
  }

  function abrirEditar(c: Churrasco, e: React.MouseEvent) {
    e.stopPropagation()
    setEditando(c)
    setEData(c.data)
    setEDesc(c.descricao ?? "")
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setSalvandoEdit(true)
    await supabase.from("churrascos").update({ data: eData, descricao: eDesc.trim() || null }).eq("id", editando.id)
    setSalvandoEdit(false)
    setEditando(null)
    await carregarLista()
  }

  async function excluirChurrasco(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExcluindo(true)
    await supabase.from("churrasco_participantes").delete().eq("churrasco_id", id)
    await supabase.from("churrasco_despesas").delete().eq("churrasco_id", id)
    await supabase.from("churrascos").delete().eq("id", id)
    setConfirmDelId(null)
    setExcluindo(false)
    await carregarLista()
  }

  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const totalPago = participantes.filter(p => p.status === "pago").reduce((s, p) => s + p.valor_devido, 0)

  if (loading) return (
    <div className={s.page}>
      <div className={s.pageHeader}><div className={s.pageTitulo}>Churrascos</div></div>
      <div className={f.spinner} />
    </div>
  )

  if (detalhe) {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}>
          <div>
            <button onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.85rem", paddingLeft: 0, marginBottom: "0.25rem" }}>
              ← Voltar
            </button>
            <div className={s.pageTitulo}>🔥 {detalhe.descricao || `Churrasco de ${fmtData(detalhe.data)}`}</div>
            <div className={s.pageSubtitulo}>{fmtData(detalhe.data)}</div>
          </div>
        </div>

        {loadingDetalhe ? <div className={f.spinner} /> : (
          <>
            {/* Aviso encerrado */}
            {detalhe.encerrado_em && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>✅</span>
                <span style={{ fontSize: "0.88rem", color: "#15803d", fontWeight: 600 }}>
                  Encerrado em {fmtData(detalhe.encerrado_em.split("T")[0])} — lançamentos já registrados no financeiro.
                </span>
              </div>
            )}

            {/* Resumo financeiro */}
            <div className={f.saldoGrid} style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: "1.25rem" }}>
              <div className={f.saldoCard}>
                <div className={f.saldoLabel}>Total gasto</div>
                <div className={f.saldoValor}>{fmtBRL(totalDespesas)}</div>
              </div>
              <div className={f.saldoCard}>
                <div className={f.saldoLabel}>Participantes</div>
                <div className={f.saldoValor}>{participantes.length}</div>
              </div>
              <div className={f.saldoCard}>
                <div className={f.saldoLabel}>Coletado</div>
                <div className={`${f.saldoValor} ${f.verde}`}>{fmtBRL(totalPago)}</div>
              </div>
            </div>

            {/* Despesas */}
            <div className={f.section}>
              <div className={f.sectionHeader}>
                <div className={f.sectionTitulo} style={{ margin: 0 }}>Despesas</div>
                {!detalhe.encerrado_em && (
                  <button className={f.btnNovo} onClick={() => setFormDespesa(v => !v)}>
                    {formDespesa ? "✕ Cancelar" : "+ Despesa"}
                  </button>
                )}
              </div>

              {formDespesa && (
                <form onSubmit={adicionarDespesa} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  <input className={f.input} style={{ flex: "2 1 180px" }} type="text" placeholder="Descrição" value={dDesc} onChange={e => setDDesc(e.target.value)} required maxLength={100} />
                  <input className={f.input} style={{ flex: "1 1 100px" }} type="number" placeholder="Valor R$" min="0.01" step="0.01" value={dValor} onChange={e => setDValor(e.target.value)} required />
                  <button className={f.btnSalvar} type="submit" disabled={salvandoDespesa}>{salvandoDespesa ? "..." : "Adicionar"}</button>
                  {erroDespesa && <div className={f.erro} style={{ width: "100%" }}>{erroDespesa}</div>}
                </form>
              )}

              {despesas.length === 0 ? (
                <div className={f.vazio}>Nenhuma despesa registrada.</div>
              ) : (
                <div className={f.extrato}>
                  {despesas.map(d => (
                    <div key={d.id} className={f.extratoRow}>
                      <div className={f.extratoInfo}>
                        <div className={f.extratoDesc}>{d.descricao}</div>
                        {d.pago_por_nome && <div className={f.extratoData}>Pago por: {d.pago_por_nome}</div>}
                      </div>
                      <div className={`${f.extratoValor} ${f.vermelho}`}>{fmtBRL(d.valor)}</div>
                      <button onClick={() => deletarDespesa(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", paddingLeft: "0.5rem" }} title="Remover">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Encerrar churrasco */}
            {!detalhe.encerrado_em && (
              <div style={{ marginBottom: "1.5rem", padding: "0.9rem 1rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#92400e", marginBottom: "0.4rem" }}>Encerrar churrasco</div>
                <div style={{ fontSize: "0.78rem", color: "#b45309", marginBottom: "0.65rem" }}>
                  Lança cada despesa como saída e cada pagamento confirmado como entrada no financeiro. Ação idempotente — pode ser desfeita apenas deletando os lançamentos manualmente.
                </div>
                {erroEncerrar && <div style={{ color: "#dc2626", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{erroEncerrar}</div>}
                <button
                  onClick={encerrarChurrasco}
                  disabled={encerrando || despesas.length === 0}
                  style={{ padding: "0.45rem 1rem", background: encerrando || despesas.length === 0 ? "#e5e7eb" : "#f59e0b", color: encerrando || despesas.length === 0 ? "#9ca3af" : "#fff", border: "none", borderRadius: 7, cursor: despesas.length === 0 ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.85rem" }}
                >
                  {encerrando ? "Lançando..." : "🔒 Encerrar e lançar no financeiro"}
                </button>
                {despesas.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.35rem" }}>Adicione ao menos uma despesa antes de encerrar.</div>}
              </div>
            )}

            {/* Participantes */}
            <div className={f.section}>
              <div className={f.sectionHeader}>
                <div className={f.sectionTitulo} style={{ margin: 0 }}>Participantes</div>
                {!detalhe.encerrado_em && (
                  <button className={f.btnNovo} onClick={() => setFormPartic(v => !v)}>
                    {formPartic ? "✕ Cancelar" : "+ Participante"}
                  </button>
                )}
              </div>

              {formPartic && (
                <form onSubmit={adicionarParticipante} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <button type="button" onClick={() => setPModo("jogador")} style={{ padding: "0.3rem 0.8rem", borderRadius: 6, border: "1px solid var(--border)", background: pModo === "jogador" ? "var(--primary)" : "var(--surface2)", color: pModo === "jogador" ? "#fff" : "var(--text)", cursor: "pointer", fontSize: "0.82rem" }}>Jogador</button>
                    <button type="button" onClick={() => setPModo("avulso")} style={{ padding: "0.3rem 0.8rem", borderRadius: 6, border: "1px solid var(--border)", background: pModo === "avulso" ? "var(--primary)" : "var(--surface2)", color: pModo === "avulso" ? "#fff" : "var(--text)", cursor: "pointer", fontSize: "0.82rem" }}>Avulso</button>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {pModo === "jogador" ? (
                      <select className={f.input} style={{ flex: 1 }} value={pJogadorId} onChange={e => setPJogadorId(e.target.value)}>
                        {jogadoresPlano.map(j => (
                          <option key={j.id} value={j.id}>{j.nome}{j.plano_mensalidade === "com_churrasco" ? " (incluso)" : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <input className={f.input} style={{ flex: 1 }} type="text" placeholder="Nome do convidado" value={pNome} onChange={e => setPNome(e.target.value)} required maxLength={80} />
                    )}
                    <button className={f.btnSalvar} type="submit" disabled={salvandoPartic}>{salvandoPartic ? "..." : "Adicionar"}</button>
                  </div>
                </form>
              )}

              {participantes.length === 0 ? (
                <div className={f.vazio}>Nenhum participante adicionado.</div>
              ) : (
                <div className={f.extrato}>
                  {participantes.map(p => (
                    <div key={p.id} className={f.extratoRow}>
                      <div className={f.extratoInfo}>
                        <div className={f.extratoDesc}>{p.nome}</div>
                        <div className={f.extratoData}>
                          {p.valor_devido === 0
                            ? <span style={{ color: "#16a34a", fontWeight: 600 }}>Incluso na mensalidade</span>
                            : fmtBRL(p.valor_devido)}
                        </div>
                      </div>
                      <select
                        value={p.status}
                        onChange={e => alterarStatus(p.id, e.target.value as any)}
                        style={{ padding: "0.25rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: statusColor[p.status], fontWeight: 700, fontSize: "0.8rem" }}
                      >
                        {(["pendente", "pago", "atrasado"] as const).map(st => (
                          <option key={st} value={st}>{statusLabel[st]}</option>
                        ))}
                      </select>
                      <button onClick={() => removerParticipante(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", paddingLeft: "0.5rem" }} title="Remover">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.pageTitulo}>Churrascos</div>
          <div className={s.pageSubtitulo}>Gerencie os churrascos da patota</div>
        </div>
        <button className={f.btnNovo} onClick={() => { setFormNovo(v => !v); setErro(null) }}>
          {formNovo ? "✕ Cancelar" : "+ Novo churrasco"}
        </button>
      </div>

      {formNovo && (
        <div className={f.formCard}>
          <div className={f.formTitulo}>Novo churrasco</div>
          <form onSubmit={criarChurrasco} className={f.form}>
            <div className={f.formRow}>
              <div>
                <label className={f.label}>Data</label>
                <input className={f.input} type="date" value={fData} onChange={e => setFData(e.target.value)} required />
              </div>
              <div>
                <label className={f.label}>Descrição (opcional)</label>
                <input className={f.input} type="text" value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Ex: Aniversário da Patota" maxLength={100} />
              </div>
            </div>
            {erro && <div className={f.erro}>{erro}</div>}
            <button className={f.btnSalvar} type="submit" disabled={salvando}>{salvando ? "Criando..." : "Criar churrasco"}</button>
          </form>
        </div>
      )}

      {churrascos.length === 0 ? (
        <div className={f.vazio}>Nenhum churrasco registrado ainda.</div>
      ) : (
        <div className={f.extrato}>
          {churrascos.map(c => (
            <div key={c.id} className={f.extratoRow} style={{ cursor: "pointer" }} onClick={() => abrirDetalhe(c)}>
              <div style={{ fontSize: "1.5rem" }}>🔥</div>
              <div className={f.extratoInfo} style={{ flex: 1 }}>
                <div className={f.extratoDesc}>{c.descricao || `Churrasco`}</div>
                <div className={f.extratoData}>{fmtData(c.data)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => abrirEditar(c, e)}
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text)" }}
                >
                  Editar
                </button>
                {confirmDelId === c.id ? (
                  <>
                    <button
                      onClick={e => excluirChurrasco(c.id, e)}
                      disabled={excluindo}
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
                    >
                      {excluindo ? "..." : "Confirmar"}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelId(null) }}
                      style={{ padding: "0.25rem 0.4rem", fontSize: "0.78rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
                    >✕</button>
                  </>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelId(c.id) }}
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "#dc2626" }}
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal editar churrasco */}
      {editando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>Editar churrasco</span>
              <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "var(--muted)" }}>✕</button>
            </div>
            <form onSubmit={salvarEdicao}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label className={f.label}>Data</label>
                <input className={f.input} type="date" value={eData} onChange={e => setEData(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className={f.label}>Descrição (opcional)</label>
                <input className={f.input} type="text" value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Ex: Aniversário da Patota" maxLength={100} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setEditando(null)} style={{ padding: "0.5rem 1rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>Cancelar</button>
                <button type="submit" disabled={salvandoEdit} className={f.btnSalvar}>{salvandoEdit ? "Salvando..." : "Salvar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
