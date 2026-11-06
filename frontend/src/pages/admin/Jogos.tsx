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
}

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
}

export default function Jogos() {
  const { usuario } = useAuth()
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ data: "", horario: "10:00", local: "", max_jogadores: "14" })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase.from("jogos").select("*").eq("patota_id", patotatId).order("data", { ascending: false })
    setJogos(data ?? [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.data || !form.local.trim() || !usuario?.patota_id) return
    setSalvando(true)
    await supabase.from("jogos").insert({
      data: form.data,
      horario: form.horario,
      local: form.local.trim(),
      max_jogadores: form.max_jogadores ? parseInt(form.max_jogadores) : null,
      status: "agendado",
      patota_id: usuario.patota_id,
    })
    setForm({ data: "", horario: "10:00", local: "", max_jogadores: "14" })
    setModal(false)
    setSalvando(false)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from("jogos").update({ status }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  function fmtData(iso: string) {
    const [a, m, d] = iso.split("-")
    return `${d}/${m}/${a}`
  }

  if (loading) return <div className={s.page}><div className={s.empty}>Carregando...</div></div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Jogos</h1>
          <div className={s.pageSubtitulo}>{jogos.length} no total</div>
        </div>
        <button className={s.btnPrimary} onClick={() => setModal(true)}>+ Novo jogo</button>
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
                <th>Máx.</th>
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
                  <td>{j.max_jogadores ?? "—"}</td>
                  <td>
                    <span className={s[`badge${j.status.charAt(0).toUpperCase() + j.status.slice(1)}`] || s.badgeAgendado}>
                      {STATUS_LABEL[j.status] ?? j.status}
                    </span>
                  </td>
                  <td>
                    <select
                      className={s.formSelect}
                      style={{ padding: "0.3rem 0.5rem", fontSize: "0.78rem" }}
                      value={j.status}
                      onChange={e => mudarStatus(j.id, e.target.value)}
                    >
                      <option value="agendado">Agendado</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="realizado">Realizado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>Novo jogo</span>
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
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModal(false)}>Cancelar</button>
              <button className={s.btnPrimary} onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Criar jogo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
