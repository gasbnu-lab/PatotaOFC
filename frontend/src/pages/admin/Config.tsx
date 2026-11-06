import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import type { Usuario } from "../../lib/useAuth"
import s from "./admin.module.css"
import cs from "./Config.module.css"

type Ctx = { usuario: Usuario; nomeTime: string }

type PatotaConfig = {
  id: number
  nome: string
  dia_vencimento: number
  valor_mensalidade: number
  local_fixo: string | null
  horario_fixo: string | null
  recado: string | null
}

export default function Config() {
  const { usuario } = useOutletContext<Ctx>()
  const [config, setConfig] = useState<PatotaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null)

  const [nome, setNome] = useState("")
  const [dia, setDia] = useState("")
  const [valor, setValor] = useState("")
  const [localFixo, setLocalFixo] = useState("")
  const [horarioFixo, setHorarioFixo] = useState("")
  const [recado, setRecado] = useState("")

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from("patota")
      .select("id, nome, dia_vencimento, valor_mensalidade, local_fixo, horario_fixo, recado")
      .eq("id", usuario.patota_id)
      .maybeSingle()
    if (data) {
      setConfig(data)
      setNome(data.nome)
      setDia(String(data.dia_vencimento))
      setValor(String(data.valor_mensalidade))
      setLocalFixo(data.local_fixo ?? "")
      setHorarioFixo(data.horario_fixo ?? "")
      setRecado(data.recado ?? "")
    }
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const diaNum = parseInt(dia)
    if (isNaN(diaNum) || diaNum < 1 || diaNum > 28) {
      setMsg({ ok: false, txt: "Dia de vencimento deve ser entre 1 e 28." })
      return
    }
    const valorNum = parseFloat(valor.replace(",", "."))
    if (isNaN(valorNum) || valorNum < 0) {
      setMsg({ ok: false, txt: "Valor inválido." })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from("patota")
      .update({
        nome: nome.trim(),
        dia_vencimento: diaNum,
        valor_mensalidade: valorNum,
        local_fixo: localFixo.trim() || null,
        horario_fixo: horarioFixo.trim() || null,
        recado: recado.trim() || null,
      })
      .eq("id", usuario.patota_id)
    setSalvando(false)
    if (error) {
      setMsg({ ok: false, txt: "Erro ao salvar. Verifique permissões." })
    } else {
      setConfig(c => c ? {
        ...c,
        nome: nome.trim(),
        dia_vencimento: diaNum,
        valor_mensalidade: valorNum,
        local_fixo: localFixo.trim() || null,
        horario_fixo: horarioFixo.trim() || null,
        recado: recado.trim() || null,
      } : c)
      setMsg({ ok: true, txt: "Configurações salvas!" })
    }
  }

  const alterado = config
    ? nome.trim() !== config.nome
      || dia !== String(config.dia_vencimento)
      || valor !== String(config.valor_mensalidade)
      || localFixo !== (config.local_fixo ?? "")
      || horarioFixo !== (config.horario_fixo ?? "")
      || recado !== (config.recado ?? "")
    : false

  if (loading) return (
    <div className={s.page}>
      <div className={s.pageHeader}><div className={s.pageTitulo}>Config. patota</div></div>
      <div className={cs.spinner} />
    </div>
  )

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.pageTitulo}>Config. patota</div>
          <div className={s.pageSubtitulo}>Configurações gerais da sua patota</div>
        </div>
      </div>

      <form onSubmit={salvar}>

        {/* Nome */}
        <div className={cs.section}>
          <div className={cs.sectionTitulo}>Identidade</div>
          <div className={cs.card}>
            <label className={cs.label}>Nome da patota</label>
            <input
              className={cs.input}
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Gas Taubaté"
              required
              maxLength={80}
            />
            <div className={cs.hint}>Aparece na página pública e no cabeçalho do admin.</div>
          </div>
        </div>

        {/* Página pública */}
        <div className={cs.section}>
          <div className={cs.sectionTitulo}>Página pública</div>
          <div className={cs.card}>
            <label className={cs.label}>Local fixo dos jogos</label>
            <input
              className={cs.input}
              type="text"
              value={localFixo}
              onChange={e => setLocalFixo(e.target.value)}
              placeholder="Ex: Arena Show de Bola — Taubaté"
              maxLength={120}
            />
            <label className={cs.label} style={{ marginTop: "1rem" }}>Dia e horário fixo</label>
            <input
              className={cs.input}
              type="text"
              value={horarioFixo}
              onChange={e => setHorarioFixo(e.target.value)}
              placeholder="Ex: Toda sexta às 20h"
              maxLength={80}
            />
            <label className={cs.label} style={{ marginTop: "1rem" }}>Recado / aviso</label>
            <textarea
              className={cs.input}
              rows={3}
              value={recado}
              onChange={e => setRecado(e.target.value)}
              placeholder="Ex: Tragam colete azul e amarelo!"
              maxLength={300}
              style={{ resize: "vertical" }}
            />
            <div className={cs.hint}>Essas informações aparecem no topo da página pública da patota.</div>
          </div>
        </div>

        {/* Mensalidades */}
        <div className={cs.section}>
          <div className={cs.sectionTitulo}>Mensalidades</div>
          <div className={cs.card}>
            <div className={cs.row2}>
              <div>
                <label className={cs.label}>Dia de vencimento</label>
                <div className={cs.inputGroup}>
                  <input
                    className={cs.inputSm}
                    type="number"
                    min={1}
                    max={28}
                    value={dia}
                    onChange={e => setDia(e.target.value)}
                    required
                  />
                  <span className={cs.inputSuffix}>de cada mês</span>
                </div>
              </div>
              <div>
                <label className={cs.label}>Valor mensal</label>
                <div className={cs.inputGroup}>
                  <span className={cs.inputPrefix}>R$</span>
                  <input
                    className={cs.inputSm}
                    type="number"
                    min={0}
                    step="0.01"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <div className={cs.hint}>
              Usado para calcular status de mensalidades e ao gerar mensalidades recorrentes.
            </div>
          </div>
        </div>

        {msg && (
          <div className={msg.ok ? cs.msgOk : cs.msgErro}>{msg.txt}</div>
        )}

        <button
          className={cs.btnSalvar}
          type="submit"
          disabled={salvando || !alterado}
        >
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </form>
    </div>
  )
}
