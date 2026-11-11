import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../lib/useAuth"
import s from "./admin.module.css"

type Mensalidade = {
  id: string
  jogador_id: string
  mes_ref: string
  pago: boolean
  valor: number | null
  jogadores?: { nome: string } | null
}

type Jogador = { id: string; nome: string; isento: boolean; plano_mensalidade: "com_churrasco" | "sem_churrasco" | null }

function statusMens(mes_ref: string, pago: boolean) {
  if (pago) return "pago"
  const hoje = new Date()
  const parts = mes_ref.split("-").map(Number)
  const [a, m] = parts
  return hoje > new Date(a, m - 1, 9) ? "atrasado" : "pendente"
}

function mesNome(iso: string) {
  const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
  const parts = iso.split("-")
  return nomes[parseInt(parts[1]) - 1] + "/" + parts[0]
}

export default function Mensalidades() {
  const { usuario } = useAuth()
  const [mens, setMens] = useState<Mensalidade[]>([])
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [valorPadrao, setValorPadrao] = useState<number | null>(null)
  const [valorComChurrasco, setValorComChurrasco] = useState<number>(60)
  const [valorSemChurrasco, setValorSemChurrasco] = useState<number>(45)
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [erroToggle, setErroToggle] = useState<string | null>(null)
  const [paginaMens, setPaginaMens] = useState(0)
  const [temMaisMens, setTemMaisMens] = useState(false)
  const [carregandoMaisMens, setCarregandoMaisMens] = useState(false)

  // form nova mensalidade (avulsa)
  const [modal, setModal] = useState(false)
  const [fJogador, setFJogador] = useState("")
  const [fMes, setFMes] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`
  })
  const [fValor, setFValor] = useState("")
  const [salvando, setSalvando] = useState(false)

  // modal geração recorrente
  const [modalRec, setModalRec] = useState(false)
  const [recMes, setRecMes] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`
  })
  const [gerando, setGerando] = useState(false)
  const [msgRec, setMsgRec] = useState<string | null>(null)

  useEffect(() => {
    if (usuario?.patota_id) {
      carregar(usuario.patota_id)
      carregarJogadores(usuario.patota_id)
      carregarConfig(usuario.patota_id)
    }
  }, [usuario?.patota_id])

  const PAGE_MENS = 50

  async function carregar(patotatId: number) {
    setLoading(true)
    setPaginaMens(0)
    const { data } = await supabase
      .from("mensalidades")
      .select("*, jogadores(nome)")
      .eq("patota_id", patotatId)
      .order("mes_ref", { ascending: false })
      .range(0, PAGE_MENS - 1)
    setMens(data ?? [])
    setTemMaisMens((data?.length ?? 0) === PAGE_MENS)
    setLoading(false)
  }

  async function carregarMaisMens() {
    if (!usuario?.patota_id) return
    setCarregandoMaisMens(true)
    const novaPag = paginaMens + 1
    const { data } = await supabase
      .from("mensalidades")
      .select("*, jogadores(nome)")
      .eq("patota_id", usuario.patota_id)
      .order("mes_ref", { ascending: false })
      .range(novaPag * PAGE_MENS, (novaPag + 1) * PAGE_MENS - 1)
    setMens(prev => [...prev, ...(data ?? [])])
    setPaginaMens(novaPag)
    setTemMaisMens((data?.length ?? 0) === PAGE_MENS)
    setCarregandoMaisMens(false)
  }

  async function carregarJogadores(patotatId: number) {
    const { data } = await supabase.from("jogadores").select("id, nome, isento, plano_mensalidade").eq("patota_id", patotatId).eq("ativo", true).order("nome")
    setJogadores((data ?? []) as Jogador[])
    if (data && data.length > 0) setFJogador(data[0].id)
  }

  async function carregarConfig(patotatId: number) {
    const { data } = await supabase.from("patota").select("valor_mensalidade, valor_mensalidade_com_churrasco, valor_mensalidade_sem_churrasco").eq("id", patotatId).maybeSingle()
    if (data) {
      setValorPadrao(data.valor_mensalidade)
      setValorComChurrasco(data.valor_mensalidade_com_churrasco ?? 60)
      setValorSemChurrasco(data.valor_mensalidade_sem_churrasco ?? 45)
    }
  }

  async function togglePago(m: Mensalidade) {
    setAtualizando(m.id)
    setErroToggle(null)
    const novoEstado = !m.pago
    const { error: errUpd } = await supabase.from("mensalidades").update({ pago: novoEstado }).eq("id", m.id)
    if (errUpd) { setErroToggle(`Erro: ${errUpd.message}`); setAtualizando(null); return }

    const mesStr = mesNome(m.mes_ref)
    const nomeJog = m.jogadores?.nome ?? "Jogador"
    const descricao = `Mensalidade ${mesStr} — ${nomeJog}`

    if (usuario?.patota_id) {
      if (novoEstado) {
        // Marcar pago: inserir lançamento de entrada
        const valor = m.valor ?? valorPadrao ?? 0
        if (valor > 0) {
          await supabase.from("lancamentos").insert({
            tipo: "entrada",
            valor,
            descricao,
            data: new Date().toISOString().split("T")[0],
            patota_id: usuario.patota_id,
          })
        }
      } else {
        // Desmarcar pago: remover lançamento correspondente
        await supabase.from("lancamentos")
          .delete()
          .eq("patota_id", usuario.patota_id)
          .eq("descricao", descricao)
          .eq("tipo", "entrada")
      }
    }

    if (usuario?.patota_id) await carregar(usuario.patota_id)
    setAtualizando(null)
  }

  async function excluir(m: Mensalidade) {
    // Se estava paga, remove o lançamento correspondente no financeiro
    if (m.pago && usuario?.patota_id) {
      const descricao = `Mensalidade ${mesNome(m.mes_ref)} — ${m.jogadores?.nome ?? "Jogador"}`
      await supabase.from("lancamentos")
        .delete()
        .eq("patota_id", usuario.patota_id)
        .eq("descricao", descricao)
        .eq("tipo", "entrada")
    }
    await supabase.from("mensalidades").delete().eq("id", m.id)
    setConfirmDelId(null)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function adicionarMensalidade() {
    if (!fJogador || !fMes || !usuario?.patota_id) return
    setSalvando(true)
    await supabase.from("mensalidades").insert({
      jogador_id: fJogador,
      mes_ref: fMes + "-01",
      pago: false,
      valor: fValor ? parseFloat(fValor) : (valorPadrao ?? 0),
      patota_id: usuario.patota_id,
    })
    setSalvando(false)
    setModal(false)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function gerarRecorrente() {
    if (!recMes || !usuario?.patota_id || jogadores.length === 0) return
    setGerando(true)
    setMsgRec(null)

    // Verifica quais jogadores já têm mensalidade nesse mês
    const { data: existentes } = await supabase
      .from("mensalidades")
      .select("jogador_id")
      .eq("patota_id", usuario.patota_id)
      .eq("mes_ref", recMes + "-01")

    const existentesIds = new Set((existentes ?? []).map(e => e.jogador_id))
    const novos = jogadores.filter(j => !existentesIds.has(j.id) && !j.isento)

    const isentos = jogadores.filter(j => j.isento).length

    if (novos.length === 0) {
      setMsgRec(`Todos os jogadores elegíveis já têm mensalidade para este mês${isentos > 0 ? ` (${isentos} isento(s) ignorado(s))` : ""}.`)
      setGerando(false)
      return
    }

    const patoId = usuario.patota_id
    const mesDate = recMes + "-01"
    const rows = novos.map(j => {
      let valorFinal: number
      if (j.plano_mensalidade === "com_churrasco") valorFinal = valorComChurrasco
      else if (j.plano_mensalidade === "sem_churrasco") valorFinal = valorSemChurrasco
      else valorFinal = valorPadrao ?? 0
      return { jogador_id: j.id, mes_ref: mesDate, pago: false, valor: valorFinal, patota_id: patoId }
    })

    const { error } = await supabase.from("mensalidades").insert(rows)
    if (error) {
      setMsgRec(`Erro ao gerar: ${error.message}`)
      setGerando(false)
      return
    }
    const isentosCount = jogadores.filter(j => j.isento).length
    setMsgRec(`${novos.length} mensalidade(s) gerada(s) para ${mesNome(recMes)}${isentosCount > 0 ? ` (${isentosCount} isento(s) ignorado(s))` : ""}.`)
    setGerando(false)
    await carregar(patoId)
  }

  const meses = [...new Set(mens.map(m => m.mes_ref))].sort().reverse()

  if (loading) return <div className={s.page}><div className={s.empty}>Carregando...</div></div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Mensalidades</h1>
          <div className={s.pageSubtitulo}>{mens.filter(m => !m.pago).length} em aberto</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={s.btnSecondary} onClick={() => { setModalRec(true); setMsgRec(null) }}>⟳ Gerar recorrente</button>
          <button className={s.btnPrimary} onClick={() => setModal(true)}>+ Adicionar</button>
        </div>
      </div>

      {erroToggle && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "0.75rem", color: "#dc2626", fontSize: "0.84rem" }}>
          {erroToggle}
        </div>
      )}

      {meses.length === 0 ? (
        <div className={s.card}><div className={s.empty}>Nenhuma mensalidade cadastrada.</div></div>
      ) : (
        meses.map(mes => {
          const doMes = mens.filter(m => m.mes_ref === mes)
          const pendentes = doMes
            .filter(m => !m.pago)
            .sort((a, b) => (a.jogadores?.nome ?? "").localeCompare(b.jogadores?.nome ?? "", "pt-BR"))
          const pagos = doMes
            .filter(m => m.pago)
            .sort((a, b) => (a.jogadores?.nome ?? "").localeCompare(b.jogadores?.nome ?? "", "pt-BR"))

          const renderLinha = (m: Mensalidade) => {
            const st = statusMens(m.mes_ref, m.pago)
            return (
              <tr key={m.id}>
                <td style={{ fontWeight: 500, color: "var(--text)" }}>
                  {m.jogadores?.nome ?? "—"}
                </td>
                <td>
                  <span className={s[`badge${st.charAt(0).toUpperCase() + st.slice(1)}`]}>
                    {st === "pago" ? "PAGO" : st === "atrasado" ? "ATRASADO" : "PENDENTE"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                    <button
                      className={s.btnSecondary}
                      style={{ padding: "0.3rem 0.8rem", fontSize: "0.78rem" }}
                      disabled={atualizando === m.id}
                      onClick={() => togglePago(m)}
                    >
                      {m.pago ? "Desmarcar" : "Marcar pago"}
                    </button>
                    {confirmDelId === m.id ? (
                      <>
                        <button onClick={() => excluir(m)} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
                          Confirmar
                        </button>
                        <button className={s.btnSecondary} style={{ padding: "0.3rem 0.5rem", fontSize: "0.78rem" }} onClick={() => setConfirmDelId(null)}>✕</button>
                      </>
                    ) : (
                      <button className={s.btnSecondary} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", color: "#dc2626" }} onClick={() => setConfirmDelId(m.id)}>
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          }

          return (
            <div key={mes} className={s.card} style={{ marginBottom: "1rem" }}>
              <div className={s.cardPad} style={{ paddingBottom: "0.5rem" }}>
                <div className={s.cardTitulo} style={{ textTransform: "capitalize" }}>
                  {mesNome(mes)}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "var(--mens-cols, 1fr 1fr)", gap: "0", borderTop: "1px solid var(--border)" }}
                className="mensGrid">
                {/* Coluna esquerda: pendentes + atrasados */}
                <div style={{ borderRight: "1px solid var(--border)", overflowX: "auto" }}>
                  <div style={{ padding: "0.4rem 1rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", background: "var(--surface2, #f9fafb)" }}>
                    Pendentes / Atrasados ({pendentes.length})
                  </div>
                  {pendentes.length === 0 ? (
                    <div style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "var(--muted)" }}>Nenhum</div>
                  ) : (
                    <table className={s.table} style={{ borderTop: "1px solid var(--border)" }}>
                      <tbody>{pendentes.map(renderLinha)}</tbody>
                    </table>
                  )}
                </div>
                {/* Coluna direita: pagos */}
                <div style={{ overflowX: "auto" }}>
                  <div style={{ padding: "0.4rem 1rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", background: "var(--surface2, #f9fafb)" }}>
                    Pagos ({pagos.length})
                  </div>
                  {pagos.length === 0 ? (
                    <div style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "var(--muted)" }}>Nenhum</div>
                  ) : (
                    <table className={s.table} style={{ borderTop: "1px solid var(--border)" }}>
                      <tbody>{pagos.map(renderLinha)}</tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}

      {temMaisMens && (
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <button className={s.btnSecondary} onClick={carregarMaisMens} disabled={carregandoMaisMens} style={{ padding: "0.4rem 1.2rem", fontSize: "0.85rem" }}>
            {carregandoMaisMens ? "Carregando..." : "Carregar mais meses"}
          </button>
        </div>
      )}

      {/* Modal nova mensalidade avulsa */}
      {modal && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>Nova mensalidade</span>
              <button className={s.modalClose} onClick={() => setModal(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.formGrid}>
                <div className={`${s.formGroup} ${s.full}`}>
                  <label className={s.formLabel}>Jogador *</label>
                  <select className={s.formSelect} value={fJogador} onChange={e => setFJogador(e.target.value)}>
                    {jogadores.map(j => <option key={j.id} value={j.id}>{j.nome}</option>)}
                  </select>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Mês de referência *</label>
                  <input className={s.formInput} type="month" value={fMes} onChange={e => setFMes(e.target.value)} />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Valor (R$)</label>
                  <input className={s.formInput} type="number" step="0.01" min="0" value={fValor} onChange={e => setFValor(e.target.value)} placeholder={valorPadrao ? String(valorPadrao) : "50.00"} />
                </div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModal(false)}>Cancelar</button>
              <button className={s.btnPrimary} onClick={adicionarMensalidade} disabled={salvando}>
                {salvando ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gerar recorrente */}
      {modalRec && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModalRec(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>Gerar mensalidades recorrentes</span>
              <button className={s.modalClose} onClick={() => setModalRec(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                Cria mensalidades para todos os {jogadores.filter(j => !j.isento).length} jogadores ativos não-isentos que ainda não têm registro no mês selecionado.
              </p>
              {(() => {
                const elegíveis = jogadores.filter(j => !j.isento)
                const comChurrasco = elegíveis.filter(j => j.plano_mensalidade === "com_churrasco")
                const semChurrasco = elegíveis.filter(j => j.plano_mensalidade === "sem_churrasco")
                const semPlano = elegíveis.filter(j => !j.plano_mensalidade)
                const partes: string[] = []
                if (comChurrasco.length) partes.push(`${comChurrasco.length} com churrasco (R$ ${valorComChurrasco.toFixed(2)})`)
                if (semChurrasco.length) partes.push(`${semChurrasco.length} sem churrasco (R$ ${valorSemChurrasco.toFixed(2)})`)
                if (semPlano.length) partes.push(`${semPlano.length} sem plano (R$ ${(valorPadrao ?? 0).toFixed(2)})`)
                return partes.length > 0 ? (
                  <div style={{ fontSize: "0.82rem", color: "var(--text)", background: "var(--surface2)", borderRadius: 7, padding: "0.5rem 0.75rem", marginBottom: "0.75rem" }}>
                    {partes.join(" · ")}
                  </div>
                ) : null
              })()}
              <div className={s.formGroup}>
                <label className={s.formLabel}>Mês de referência</label>
                <input className={s.formInput} type="month" value={recMes} onChange={e => setRecMes(e.target.value)} />
              </div>
              {msgRec && (
                <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.9rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, fontSize: "0.85rem", color: "#166534" }}>
                  {msgRec}
                </div>
              )}
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModalRec(false)}>Fechar</button>
              <button className={s.btnPrimary} onClick={gerarRecorrente} disabled={gerando}>
                {gerando ? "Gerando..." : "Gerar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
