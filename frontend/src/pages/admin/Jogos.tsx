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

type Form = { data: string; horario: string; local: string; max_jogadores: string; status: string }

const FORM_VAZIO: Form = { data: "", horario: "10:00", local: "", max_jogadores: "14", status: "agendado" }

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
  const [editando, setEditando] = useState<Jogo | null>(null)
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase.from("jogos").select("*").eq("patota_id", patotatId).order("data", { ascending: false })
    setJogos(data ?? [])
    setLoading(false)
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
        <button className={s.btnPrimary} onClick={abrirNovo}>+ Novo jogo</button>
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
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      <button className={s.btnSecondary} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }} onClick={() => abrirEditar(j)}>
                        Editar
                      </button>
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
