import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../lib/useAuth"
import s from "./admin.module.css"

type Jogador = {
  id: string
  nome: string
  email: string | null
  posicao: string | null
  nota: number | null
  ativo: boolean
}

type Form = { nome: string; email: string; posicao: string; nota: string }

function iniciais(nome: string) {
  const p = nome.split(" ")
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
}

const FORM_VAZIO: Form = { nome: "", email: "", posicao: "qualquer", nota: "5" }

export default function Jogadores() {
  const { usuario } = useAuth()
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Jogador | null>(null)
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  const adminEhJogador = jogadores.some(
    j => j.email && usuario?.email && j.email.toLowerCase() === usuario.email.toLowerCase()
  )

  useEffect(() => {
    if (usuario?.patota_id) carregar(usuario.patota_id)
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase.from("jogadores").select("*").eq("patota_id", patotatId).order("nome")
    setJogadores(data ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModal(true)
  }

  function abrirEditar(j: Jogador) {
    setEditando(j)
    setForm({ nome: j.nome, email: j.email ?? "", posicao: j.posicao ?? "qualquer", nota: String(j.nota ?? 5) })
    setModal(true)
  }

  function abrirModalAdmin() {
    setEditando(null)
    setForm({ nome: usuario?.nome ?? "", email: usuario?.email ?? "", posicao: "qualquer", nota: "5" })
    setModal(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !usuario?.patota_id) return
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      posicao: form.posicao || "qualquer",
      nota: form.nota ? parseInt(form.nota) : 5,
    }
    if (editando) {
      await supabase.from("jogadores").update(payload).eq("id", editando.id)
    } else {
      await supabase.from("jogadores").insert({ ...payload, ativo: true, patota_id: usuario.patota_id })
    }
    setModal(false)
    setEditando(null)
    setForm(FORM_VAZIO)
    setSalvando(false)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("jogadores").update({ ativo: !ativo }).eq("id", id)
    if (usuario?.patota_id) await carregar(usuario.patota_id)
  }

  async function excluir(id: string) {
    await supabase.from("jogadores").delete().eq("id", id)
    setConfirmDelId(null)
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
        <button className={s.btnPrimary} onClick={abrirNovo}>+ Adicionar</button>
      </div>

      {!loading && !adminEhJogador && (
        <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 10, padding: "0.9rem 1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1.2rem" }}>⚽</span>
          <span style={{ flex: 1, fontSize: "0.9rem", color: "#92400e" }}>Você ainda não está cadastrado como jogador da patota.</span>
          <button onClick={abrirModalAdmin} style={{ padding: "0.4rem 1rem", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            Me cadastrar como jogador
          </button>
        </div>
      )}

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
                <th>Nota</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jogadores.map(j => (
                <tr key={j.id} style={{ opacity: j.ativo ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className={s.avatar}>{iniciais(j.nome)}</div>
                      <div style={{ fontWeight: 500, color: "var(--text)" }}>{j.nome}</div>
                    </div>
                  </td>
                  <td>{j.email ?? "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{j.posicao ?? "—"}</td>
                  <td>{j.nota ?? "—"}</td>
                  <td>
                    <span className={j.ativo ? s.badgeConfirmado : s.badgeCancelado}>
                      {j.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      <button className={s.btnSecondary} style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }} onClick={() => abrirEditar(j)}>
                        Editar
                      </button>
                      <button
                        className={s.btnSecondary}
                        style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }}
                        onClick={() => toggleAtivo(j.id, j.ativo)}
                      >
                        {j.ativo ? "Inativar" : "Ativar"}
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
              <span className={s.modalTitulo}>{editando ? "Editar jogador" : "Novo jogador"}</span>
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
                  <label className={s.formLabel}>Posição</label>
                  <select className={s.formSelect} value={form.posicao} onChange={e => setForm(f => ({...f, posicao: e.target.value}))}>
                    <option value="qualquer">Qualquer</option>
                    <option value="goleiro">Goleiro</option>
                    <option value="linha">Linha</option>
                  </select>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Nota (1–10)</label>
                  <select className={s.formSelect} value={form.nota} onChange={e => setForm(f => ({...f, nota: e.target.value}))}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setModal(false)}>Cancelar</button>
              <button className={s.btnPrimary} onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
