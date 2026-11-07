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
  valor_mensalidade_com_churrasco: number
  valor_mensalidade_sem_churrasco: number
  valor_adicional_churrasco: number
  local_fixo: string | null
  horario_fixo: string | null
  recado: string | null
  logo_url: string | null
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
  const [valorComChurrasco, setValorComChurrasco] = useState("")
  const [valorSemChurrasco, setValorSemChurrasco] = useState("")
  const [valorAdicionalChurrasco, setValorAdicionalChurrasco] = useState("")
  const [localFixo, setLocalFixo] = useState("")
  const [horarioFixo, setHorarioFixo] = useState("")
  const [recado, setRecado] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from("patota")
      .select("id, nome, dia_vencimento, valor_mensalidade, valor_mensalidade_com_churrasco, valor_mensalidade_sem_churrasco, valor_adicional_churrasco, local_fixo, horario_fixo, recado, logo_url")
      .eq("id", usuario.patota_id)
      .maybeSingle()
    if (data) {
      setConfig(data)
      setNome(data.nome)
      setDia(String(data.dia_vencimento))
      setValor(String(data.valor_mensalidade))
      setValorComChurrasco(String(data.valor_mensalidade_com_churrasco ?? 60))
      setValorSemChurrasco(String(data.valor_mensalidade_sem_churrasco ?? 45))
      setValorAdicionalChurrasco(String(data.valor_adicional_churrasco ?? 15))
      setLocalFixo(data.local_fixo ?? "")
      setHorarioFixo(data.horario_fixo ?? "")
      setRecado(data.recado ?? "")
      setLogoUrl(data.logo_url ?? null)
    }
    setLoading(false)
  }

  async function uploadLogo(file: File) {
    if (!usuario?.patota_id) return
    setUploadingLogo(true)
    const ext = file.name.split(".").pop()
    const path = `patota-${usuario.patota_id}.${ext}`
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true })
    if (upErr) {
      setMsg({ ok: false, txt: "Erro ao fazer upload da logo." })
      setUploadingLogo(false)
      return
    }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path)
    const url = urlData.publicUrl
    await supabase.from("patota").update({ logo_url: url }).eq("id", usuario.patota_id)
    setLogoUrl(url)
    setMsg({ ok: true, txt: "Logo atualizada!" })
    setUploadingLogo(false)
  }

  async function removerLogo() {
    if (!usuario?.patota_id || !logoUrl) return
    await supabase.from("patota").update({ logo_url: null }).eq("id", usuario.patota_id)
    setLogoUrl(null)
    setMsg({ ok: true, txt: "Logo removida." })
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
    const valorComNum = parseFloat(valorComChurrasco.replace(",", "."))
    const valorSemNum = parseFloat(valorSemChurrasco.replace(",", "."))
    const valorAdicNum = parseFloat(valorAdicionalChurrasco.replace(",", "."))
    if (isNaN(valorComNum) || isNaN(valorSemNum) || isNaN(valorAdicNum)) {
      setMsg({ ok: false, txt: "Valores de plano inválidos." })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from("patota")
      .update({
        nome: nome.trim(),
        dia_vencimento: diaNum,
        valor_mensalidade: valorNum,
        valor_mensalidade_com_churrasco: valorComNum,
        valor_mensalidade_sem_churrasco: valorSemNum,
        valor_adicional_churrasco: valorAdicNum,
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
        valor_mensalidade_com_churrasco: valorComNum,
        valor_mensalidade_sem_churrasco: valorSemNum,
        valor_adicional_churrasco: valorAdicNum,
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
      || valorComChurrasco !== String(config.valor_mensalidade_com_churrasco ?? 60)
      || valorSemChurrasco !== String(config.valor_mensalidade_sem_churrasco ?? 45)
      || valorAdicionalChurrasco !== String(config.valor_adicional_churrasco ?? 15)
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

        {/* Logo */}
        <div className={cs.section}>
          <div className={cs.sectionTitulo}>Identidade</div>
          <div className={cs.card}>
            <label className={cs.label}>Logo da patota</label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 8, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "1.5rem" }}>⚽</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ cursor: "pointer" }}>
                  <span className={cs.input} style={{ padding: "0.4rem 0.9rem", display: "inline-block", cursor: "pointer", fontSize: "0.85rem", width: "auto" }}>
                    {uploadingLogo ? "Enviando..." : logoUrl ? "Trocar imagem" : "Escolher imagem"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={uploadingLogo}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
                  />
                </label>
                {logoUrl && (
                  <button type="button" onClick={removerLogo} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "0.8rem", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    Remover logo
                  </button>
                )}
              </div>
            </div>
            <div className={cs.hint}>PNG, JPG ou SVG. Aparece na página pública da patota.</div>
          </div>
        </div>

        {/* Nome */}
        <div className={cs.section}>
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
                <label className={cs.label}>Valor padrão (sem plano)</label>
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
            <div style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)", marginBottom: "0.75rem" }}>Planos de mensalidade</div>
            <div className={cs.row2}>
              <div>
                <label className={cs.label}>Plano com churrasco</label>
                <div className={cs.inputGroup}>
                  <span className={cs.inputPrefix}>R$</span>
                  <input
                    className={cs.inputSm}
                    type="number"
                    min={0}
                    step="0.01"
                    value={valorComChurrasco}
                    onChange={e => setValorComChurrasco(e.target.value)}
                  />
                  <span className={cs.inputSuffix}>/mês</span>
                </div>
              </div>
              <div>
                <label className={cs.label}>Plano sem churrasco</label>
                <div className={cs.inputGroup}>
                  <span className={cs.inputPrefix}>R$</span>
                  <input
                    className={cs.inputSm}
                    type="number"
                    min={0}
                    step="0.01"
                    value={valorSemChurrasco}
                    onChange={e => setValorSemChurrasco(e.target.value)}
                  />
                  <span className={cs.inputSuffix}>/mês</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label className={cs.label}>Adicional por churrasco (plano sem churrasco)</label>
              <div className={cs.inputGroup}>
                <span className={cs.inputPrefix}>R$</span>
                <input
                  className={cs.inputSm}
                  type="number"
                  min={0}
                  step="0.01"
                  value={valorAdicionalChurrasco}
                  onChange={e => setValorAdicionalChurrasco(e.target.value)}
                />
                <span className={cs.inputSuffix}>por churrasco</span>
              </div>
            </div>
            <div className={cs.hint} style={{ marginTop: "0.75rem" }}>
              Jogadores com plano "com churrasco" não pagam adicional. Avulsos e jogadores sem plano sempre pagam o adicional.
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
