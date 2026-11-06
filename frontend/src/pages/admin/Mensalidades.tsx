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
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
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

  async function togglePago(id: string, pago: boolean) {
    setAtualizando(id)
    await supabase.from("mensalidades").update({ pago: !pago }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
    setAtualizando(null)
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
                          <button
                            className={s.btnSecondary}
                            style={{ padding: "0.3rem 0.8rem", fontSize: "0.78rem" }}
                            disabled={atualizando === m.id}
                            onClick={() => togglePago(m.id, m.pago)}
                          >
                            {m.pago ? "Desmarcar" : "Marcar pago"}
                          </button>
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
    </div>
  )
}
