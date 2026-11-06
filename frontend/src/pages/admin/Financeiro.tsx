import { useEffect, useState, useRef } from "react"
import { useOutletContext } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import type { Usuario } from "../../lib/useAuth"
import s from "./admin.module.css"
import f from "./Financeiro.module.css"

type Ctx = { usuario: Usuario; nomeTime: string }

type Lancamento = {
  id: string
  tipo: "entrada" | "saida"
  valor: number
  descricao: string
  data: string
  criado_em: string
}

type MensResumo = { pago: number; pendente: number; atrasado: number; valorPago: number; valorPendente: number; valorAtrasado: number }

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtData(iso: string) {
  const [a, m, d] = iso.split("-")
  return `${d}/${m}/${a}`
}
function statusMens(mes_ref: string, pago: boolean): "pago" | "pendente" | "atrasado" {
  if (pago) return "pago"
  const hoje = new Date()
  const [ano, mes] = mes_ref.split("-").map(Number)
  return hoje > new Date(ano, mes - 1, 9) ? "atrasado" : "pendente"
}
function mesLabel(iso: string) {
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
  const [, m] = iso.split("-").map(Number)
  return nomes[m - 1]
}

export default function Financeiro() {
  const { usuario } = useOutletContext<Ctx>()
  const [loading, setLoading] = useState(true)
  const [saldo, setSaldo] = useState(0)
  const [totalEntradas, setTotalEntradas] = useState(0)
  const [totalSaidas, setTotalSaidas] = useState(0)
  const [mensResumo, setMensResumo] = useState<MensResumo>({ pago: 0, pendente: 0, atrasado: 0, valorPago: 0, valorPendente: 0, valorAtrasado: 0 })
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [filtro, setFiltro] = useState<"todos" | "entrada" | "saida">("todos")
  const [grafico, setGrafico] = useState<{ mes: string; entradas: number; saidas: number }[]>([])

  // form
  const [formAberto, setFormAberto] = useState(false)
  const [fTipo, setFTipo] = useState<"entrada" | "saida">("entrada")
  const [fDescricao, setFDescricao] = useState("")
  const [fValor, setFValor] = useState("")
  const [fData, setFData] = useState(new Date().toISOString().split("T")[0])
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const pid = usuario.patota_id

    // Lançamentos (todos para saldo + gráfico)
    const { data: todoLanc } = await supabase
      .from("lancamentos")
      .select("tipo, valor, data")
      .eq("patota_id", pid)
      .order("data", { ascending: false })

    if (todoLanc) {
      const entradas = todoLanc.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0)
      const saidas = todoLanc.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0)
      setTotalEntradas(entradas)
      setTotalSaidas(saidas)
      setSaldo(entradas - saidas)

      // Gráfico: últimos 6 meses
      const meses: { mes: string; entradas: number; saidas: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - i)
        const mesStr = d.toISOString().slice(0, 7)
        const e = todoLanc.filter(l => l.tipo === "entrada" && l.data.startsWith(mesStr)).reduce((s, l) => s + Number(l.valor), 0)
        const s2 = todoLanc.filter(l => l.tipo === "saida" && l.data.startsWith(mesStr)).reduce((s, l) => s + Number(l.valor), 0)
        meses.push({ mes: mesLabel(mesStr + "-01"), entradas: e, saidas: s2 })
      }
      setGrafico(meses)
    }

    // Lançamentos recentes
    const { data: lancRecentes } = await supabase
      .from("lancamentos")
      .select("id, tipo, valor, descricao, data, criado_em")
      .eq("patota_id", pid)
      .order("data", { ascending: false })
      .limit(30)
    setLancamentos(lancRecentes ?? [])

    // Mensalidades do mês corrente
    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`
    const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).toISOString().split("T")[0]
    const { data: mens } = await supabase
      .from("mensalidades")
      .select("pago, valor, mes_ref")
      .eq("patota_id", pid)
      .gte("mes_ref", mesAtual)
      .lt("mes_ref", proximoMes)

    if (mens) {
      const r: MensResumo = { pago: 0, pendente: 0, atrasado: 0, valorPago: 0, valorPendente: 0, valorAtrasado: 0 }
      for (const m of mens) {
        const st = statusMens(m.mes_ref, m.pago)
        r[st]++
        r[`valor${st.charAt(0).toUpperCase() + st.slice(1)}` as keyof MensResumo] += Number(m.valor)
      }
      setMensResumo(r)
    }

    setLoading(false)
  }

  async function inserirLancamento(e: React.FormEvent) {
    e.preventDefault()
    setErroForm(null)
    const valorNum = parseFloat(fValor.replace(",", "."))
    if (isNaN(valorNum) || valorNum <= 0) { setErroForm("Valor inválido."); return }
    if (!fDescricao.trim()) { setErroForm("Descrição obrigatória."); return }
    setSalvando(true)
    const { error } = await supabase.from("lancamentos").insert({
      tipo: fTipo,
      valor: valorNum,
      descricao: fDescricao.trim(),
      data: fData,
      patota_id: usuario.patota_id,
    })
    setSalvando(false)
    if (error) { setErroForm(`Erro: ${error.message}`); return }
    setFormAberto(false)
    setFDescricao("")
    setFValor("")
    setFData(new Date().toISOString().split("T")[0])
    setFTipo("entrada")
    carregar()
  }

  const lancFiltrados = filtro === "todos" ? lancamentos : lancamentos.filter(l => l.tipo === filtro)
  const maxGrafico = Math.max(...grafico.map(g => Math.max(g.entradas, g.saidas)), 1)

  if (loading) return (
    <div className={s.page}>
      <div className={s.pageHeader}><div className={s.pageTitulo}>Financeiro</div></div>
      <div className={f.spinner} />
    </div>
  )

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.pageTitulo}>Financeiro</div>
          <div className={s.pageSubtitulo}>Extrato e resumo financeiro da patota</div>
        </div>
        <button className={f.btnNovo} onClick={() => { setFormAberto(v => !v); setErroForm(null) }}>
          {formAberto ? "✕ Cancelar" : "+ Novo lançamento"}
        </button>
      </div>

      {/* Formulário novo lançamento */}
      {formAberto && (
        <div className={f.formCard} ref={formRef}>
          <div className={f.formTitulo}>Novo lançamento</div>
          <form onSubmit={inserirLancamento} className={f.form}>
            <div className={f.formRow}>
              <div>
                <label className={f.label}>Tipo</label>
                <select className={f.select} value={fTipo} onChange={e => setFTipo(e.target.value as "entrada" | "saida")}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div>
                <label className={f.label}>Valor (R$)</label>
                <input className={f.input} type="number" min="0.01" step="0.01" value={fValor} onChange={e => setFValor(e.target.value)} placeholder="0,00" required />
              </div>
              <div>
                <label className={f.label}>Data</label>
                <input className={f.input} type="date" value={fData} onChange={e => setFData(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={f.label}>Descrição</label>
              <input className={f.inputFull} type="text" value={fDescricao} onChange={e => setFDescricao(e.target.value)} placeholder="Ex: Aluguel do campo — julho" required maxLength={120} />
            </div>
            {erroForm && <div className={f.erro}>{erroForm}</div>}
            <button className={f.btnSalvar} type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar lançamento"}
            </button>
          </form>
        </div>
      )}

      {/* Cards de saldo */}
      <div className={f.saldoGrid}>
        <div className={`${f.saldoCard} ${f.saldoTotal}`}>
          <div className={f.saldoLabel}>Saldo atual</div>
          <div className={f.saldoValor}>{fmtBRL(saldo)}</div>
        </div>
        <div className={f.saldoCard}>
          <div className={f.saldoLabel}>↑ Entradas</div>
          <div className={`${f.saldoValor} ${f.verde}`}>{fmtBRL(totalEntradas)}</div>
        </div>
        <div className={f.saldoCard}>
          <div className={f.saldoLabel}>↓ Saídas</div>
          <div className={`${f.saldoValor} ${f.vermelho}`}>{fmtBRL(totalSaidas)}</div>
        </div>
      </div>

      {/* Resumo mensalidades */}
      <div className={f.section}>
        <div className={f.sectionTitulo}>Mensalidades — mês atual</div>
        <div className={f.mensGrid}>
          <div className={f.mensCard}>
            <div className={f.mensNum}>{mensResumo.pago}</div>
            <div className={f.mensLabel}>Pagas</div>
            <div className={f.mensValor}>{fmtBRL(mensResumo.valorPago)}</div>
          </div>
          <div className={f.mensCard}>
            <div className={`${f.mensNum} ${f.warning}`}>{mensResumo.pendente}</div>
            <div className={f.mensLabel}>Pendentes</div>
            <div className={f.mensValor}>{fmtBRL(mensResumo.valorPendente)}</div>
          </div>
          <div className={f.mensCard}>
            <div className={`${f.mensNum} ${f.vermelho}`}>{mensResumo.atrasado}</div>
            <div className={f.mensLabel}>Atrasadas</div>
            <div className={f.mensValor}>{fmtBRL(mensResumo.valorAtrasado)}</div>
          </div>
        </div>
      </div>

      {/* Gráfico 6 meses */}
      {grafico.some(g => g.entradas > 0 || g.saidas > 0) && (
        <div className={f.section}>
          <div className={f.sectionTitulo}>Últimos 6 meses</div>
          <div className={f.graficoCard}>
            <div className={f.graficoLegenda}>
              <span className={f.legVerde}>■ Entradas</span>
              <span className={f.legVermelho}>■ Saídas</span>
            </div>
            <div className={f.barras}>
              {grafico.map(g => (
                <div key={g.mes} className={f.barraGrupo}>
                  <div className={f.barrasCol}>
                    <div className={f.barra} style={{ height: `${(g.entradas / maxGrafico) * 100}%`, background: "#16a34a" }} title={fmtBRL(g.entradas)} />
                    <div className={f.barra} style={{ height: `${(g.saidas / maxGrafico) * 100}%`, background: "#dc2626" }} title={fmtBRL(g.saidas)} />
                  </div>
                  <div className={f.barraMes}>{g.mes}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Extrato */}
      <div className={f.section}>
        <div className={f.sectionHeader}>
          <div className={f.sectionTitulo} style={{ margin: 0 }}>Extrato</div>
          <div className={f.filtros}>
            {(["todos", "entrada", "saida"] as const).map(op => (
              <button key={op} className={`${f.filtroBtn} ${filtro === op ? f.filtroBtnAtivo : ""}`} onClick={() => setFiltro(op)}>
                {op === "todos" ? "Todos" : op === "entrada" ? "Entradas" : "Saídas"}
              </button>
            ))}
          </div>
        </div>

        {lancFiltrados.length === 0 ? (
          <div className={f.vazio}>Nenhum lançamento{filtro !== "todos" ? " deste tipo" : ""}.</div>
        ) : (
          <div className={f.extrato}>
            {lancFiltrados.map(l => (
              <div key={l.id} className={f.extratoRow}>
                <div className={`${f.extratoTipo} ${l.tipo === "entrada" ? f.verde : f.vermelho}`}>
                  {l.tipo === "entrada" ? "↑" : "↓"}
                </div>
                <div className={f.extratoInfo}>
                  <div className={f.extratoDesc}>{l.descricao}</div>
                  <div className={f.extratoData}>{fmtData(l.data)}</div>
                </div>
                <div className={`${f.extratoValor} ${l.tipo === "entrada" ? f.verde : f.vermelho}`}>
                  {l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
