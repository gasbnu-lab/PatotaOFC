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

type Jogador = { id: string; nome: string }

function statusMens(mes_ref: string, pago: boolean) {
  if (pago) return "pago"
  const hoje = new Date()
  const [a, m] = mes_ref.split("-").map(Number)
  return hoje > new Date(a, m - 1, 9) ? "atrasado" : "pendente"
}

function mesNome(iso: string) {
  const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
  return nomes[parseInt(iso.split("-")[1]) - 1] + "/" + iso.split("-")[0]
}

export default function Mensalidades() {
  const { usuario } = useAuth()
  const [mens, setMens] = useState<Mensalidade[]>([])
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  // form nova mensalidade
  const [modal, setModal] = useState(false)
  const [fJogador, setFJogador] = useState("")
  const [fMes, setFMes] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`
  })
  const [fValor, setFValor] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (usuario?.patota_id) {
      carregar(usuario.patota_id)
      carregarJogadores(usuario.patota_id)
    }
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase
      .from("mensalidades")
      .select("*, jogadores(nome)")
      .eq("patota_id", patotatId)
      .order("mes_ref", { ascending: false })
    setMens(data ?? [])
    setLoading(false)
  }

  async function carregarJogadores(patotatId: number) {
    const { data } = await supabase.from("jogadores").select("id, nome").eq("patota_id", patotatId).eq("ativo", true).order("nome")
    setJogadores(data ?? [])
    if (data && data.length > 0) setFJogador(data[0].id)
  }

  async function togglePago(id: string, pago: boolean) {
    setAtualizando(id)
    await supabase.from("mensalidades").update({ pago: !pago }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
    setAtualizando(null)
  }

  async function excluir(id: string) {
    await supabase.from("mensalidades").delete().eq("id", id)
    setConfirmDelId(null)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function adicionarMensalidade() {
    if (!fJogador || !fMes || !usuario?.patota_id) return
    setSalvando(true)
    await supabase.from("mensalidades").insert({
      jogador_id: fJogador,
      mes_ref: fMes,
      pago: false,
      valor: fValor ? parseFloat(fValor) : null,
      patota_id: usuario.patota_id,
    })
    setSalvando(false)
    setModal(false)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
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
        <button className={s.btnPrimary} onClick={() => setModal(true)}>+ Adicionar</button>
      </div>

      {meses.length === 0 ? (
        <div className={s.card}><div className={s.empty}>Nenhuma mensalidade cadastrada.</div></div>
      ) : (
        meses.map(mes => {
          const doMes = mens.filter(m => m.mes_ref === mes)
          return (
            <div key={mes} className={s.card} style={{ marginBottom: "1rem" }}>
              <div className={s.cardPad} style={{ paddingBottom: "0.5rem" }}>
                <div className={s.cardTitulo} style={{ textTransform: "capitalize" }}>
                  {mesNome(mes)}
                </div>
              </div>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Jogador</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {doMes.map(m => {
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
                              onClick={() => togglePago(m.id, m.pago)}
                            >
                              {m.pago ? "Desmarcar" : "Marcar pago"}
                            </button>
                            {confirmDelId === m.id ? (
                              <>
                                <button onClick={() => excluir(m.id)} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
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
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}

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
                  <input className={s.formInput} type="number" step="0.01" min="0" value={fValor} onChange={e => setFValor(e.target.value)} placeholder="50.00" />
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
    </div>
  )
}
