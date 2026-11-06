import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../lib/useAuth"
import s from "./admin.module.css"

type Jogador = {
  id: string
  nome: string
  email: string | null
  apelido: string | null
  posicao: string | null
  nivel: number | null
  ativo: boolean
}

function iniciais(nome: string) {
  const p = nome.split(" ")
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
}

export default function Jogadores() {
  const { usuario } = useAuth()
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: "", email: "", apelido: "", posicao: "", nivel: "3" })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase.from("jogadores").select("*").eq("patota_id", patotatId).order("nome")
    setJogadores(data ?? [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.nome.trim() || !usuario?.patota_id) return
    setSalvando(true)
    await supabase.from("jogadores").insert({
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      apelido: form.apelido.trim() || null,
      posicao: form.posicao || null,
      nivel: form.nivel ? parseInt(form.nivel) : null,
      ativo: true,
      patota_id: usuario.patota_id,
    })
    setForm({ nome: "", email: "", apelido: "", posicao: "", nivel: "3" })
    setModal(false)
    setSalvando(false)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("jogadores").update({ ativo: !ativo }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  if (loading) return <div className={s.page}><div className={s.empty}>Carregando...</div></div>

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitulo}>Jogadores</h1>
          <div className={s.pageSubtitulo}>{jogadores.filter(j => j.ativo).length} ativos</div>
        </div>
        <button className={s.btnPrimary} onClick={() => setModal(true)}>+ Adicionar</button>
      </div>

      <div className={s.card}>
        {jogadores.length === 0 ? (
          <div className={s.empty}>Nenhum jogador cadastrado ainda.</div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Email</th>
                <th>Posição</th>
                <th>Nível</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jogadores.map(j => (
                <tr key={j.id} style={{ cursor: "pointer" }} onClick={() => toggleAtivo(j.id, j.ativo)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className={s.avatar}>{iniciais(j.nome)}</div>
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>{j.nome}</div>
                        {j.apelido && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{j.apelido}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{j.email ?? "—"}</td>
                  <td>{j.posicao ?? "—"}</td>
                  <td>{j.nivel ?? "—"}</td>
                  <td>
                    <span className={j.ativo ? s.badgeConfirmado : s.badgeCancelado}>
                      {j.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className={s.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <span className={s.modalTitulo}>Novo jogador</span>
              <button className={s.modalClose} onClick={() => setModal(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.formGrid}>
                <div className={`${s.formGroup} ${s.full}`}>
                  <label className={s.formLabel}>Nome *</label>
                  <input className={s.formInput} value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} placeholder="Rafael Souza" />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Email</label>
                  <input className={s.formInput} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="jogador@email.com" />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Apelido</label>
                  <input className={s.formInput} value={form.apelido} onChange={e => setForm(f => ({...f, apelido: e.target.value}))} placeholder="Rafael" />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Posição</label>
                  <select className={s.formSelect} value={form.posicao} onChange={e => setForm(f => ({...f, posicao: e.target.value}))}>
                    <option value="">—</option>
                    <option value="Goleiro">Goleiro</option>
                    <option value="Zagueiro">Zagueiro</option>
                    <option value="Lateral">Lateral</option>
                    <option value="Meia">Meia</option>
                    <option value="Atacante">Atacante</option>
                  </select>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Nível (1–5)</label>
                  <select className={s.formSelect} value={form.nivel} onChange={e => setForm(f => ({...f, nivel: e.target.value}))}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModal(false)}>Cancelar</button>
              <button className={s.btnPrimary} onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
