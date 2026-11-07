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
  isento: boolean
  plano_mensalidade: "com_churrasco" | "sem_churrasco" | null
}

type UsuarioAcesso = {
  id: string
  nome: string
  email: string | null
  role: "membro" | "admin"
  status: string
}

type Form = { nome: string; email: string; posicao: string; nota: string; isento: boolean; plano_mensalidade: "com_churrasco" | "sem_churrasco" | "" }

function iniciais(nome: string) {
  const p = nome.split(" ")
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
}

const FORM_VAZIO: Form = { nome: "", email: "", posicao: "qualquer", nota: "5", isento: false, plano_mensalidade: "" }

export default function Jogadores() {
  const { usuario } = useAuth()
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Jogador | null>(null)
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const adminEhJogador = jogadores.some(
    j => j.email && usuario?.email && j.email.toLowerCase() === usuario.email.toLowerCase()
  )

  useEffect(() => {
    if (usuario?.patota_id) {
      carregar(usuario.patota_id)
      carregarUsuarios(usuario.patota_id)
    }
  }, [usuario?.patota_id])

  async function carregar(patotatId: number) {
    setLoading(true)
    const { data } = await supabase.from("jogadores").select("*").eq("patota_id", patotatId).order("nome")
    setJogadores(data ?? [])
    setLoading(false)
  }

  async function carregarUsuarios(patotatId: number) {
    const { data } = await supabase
      .from("usuarios")
      .select("id, nome, email, role, status")
      .eq("patota_id", patotatId)
      .order("nome")
    setUsuarios((data ?? []) as UsuarioAcesso[])
  }

  async function toggleRole(u: UsuarioAcesso) {
    if (u.id === usuario?.id) return
    setTogglingId(u.id)
    const novoRole = u.role === "admin" ? "membro" : "admin"
    await supabase.from("usuarios").update({ role: novoRole }).eq("id", u.id)
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, role: novoRole } : x))
    setTogglingId(null)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModal(true)
  }

  function abrirEditar(j: Jogador) {
    setEditando(j)
    setForm({ nome: j.nome, email: j.email ?? "", posicao: j.posicao ?? "qualquer", nota: String(j.nota ?? 5), isento: j.isento, plano_mensalidade: j.plano_mensalidade ?? "" })
    setModal(true)
  }

  function abrirModalAdmin() {
    setEditando(null)
    setForm({ nome: usuario?.nome ?? "", email: usuario?.email ?? "", posicao: "qualquer", nota: "5", isento: false, plano_mensalidade: "" })
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
      isento: form.isento,
      plano_mensalidade: form.plano_mensalidade || null,
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
                <th>Posição</th>
                <th>Nota</th>
                <th>Mensalidade</th>
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
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>{j.nome}</div>
                        {j.email && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{j.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{j.posicao ?? "—"}</td>
                  <td>{j.nota ?? "—"}</td>
                  <td>
                    {j.isento ? (
                      <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", background: "#f3f4f6", color: "#6b7280", borderRadius: 5 }}>Isento</span>
                    ) : j.plano_mensalidade === "com_churrasco" ? (
                      <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", background: "#fef9c3", color: "#854d0e", borderRadius: 5 }}>Com churrasco</span>
                    ) : j.plano_mensalidade === "sem_churrasco" ? (
                      <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", background: "#dbeafe", color: "#1e40af", borderRadius: 5 }}>Sem churrasco</span>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>—</span>
                    )}
                  </td>
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

      <div style={{ marginTop: "2rem" }}>
        <div className={s.pageHeader} style={{ marginBottom: "0.75rem" }}>
          <div>
            <h2 className={s.pageTitulo} style={{ fontSize: "1.1rem" }}>Acesso ao sistema</h2>
            <div className={s.pageSubtitulo}>{usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""} cadastrado{usuarios.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div className={s.card}>
          {usuarios.length === 0 ? (
            <div className={s.empty}>Nenhum usuário cadastrado ainda.</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Status</th>
                  <th>Acesso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>{u.nome}</div>
                        {u.email && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{u.email}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={u.status === "aprovado" ? s.badgeConfirmado : u.status === "pendente" ? s.badgePendente : s.badgeCancelado}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: "0.78rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: 5,
                        background: u.role === "admin" ? "#dbeafe" : "#f3f4f6",
                        color: u.role === "admin" ? "#1d4ed8" : "#6b7280",
                        fontWeight: u.role === "admin" ? 700 : 400,
                      }}>
                        {u.role === "admin" ? "Admin" : "Membro"}
                      </span>
                    </td>
                    <td>
                      {u.id !== usuario?.id ? (
                        <button
                          className={s.btnSecondary}
                          style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }}
                          onClick={() => toggleRole(u)}
                          disabled={togglingId === u.id}
                        >
                          {togglingId === u.id ? "..." : u.role === "admin" ? "Remover admin" : "Dar admin"}
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Você</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Plano de mensalidade</label>
                  <select className={s.formSelect} value={form.plano_mensalidade} onChange={e => setForm(f => ({...f, plano_mensalidade: e.target.value as any}))}>
                    <option value="">Sem plano</option>
                    <option value="com_churrasco">Com churrasco (R$60/mês)</option>
                    <option value="sem_churrasco">Sem churrasco (R$45/mês)</option>
                  </select>
                </div>
                <div className={`${s.formGroup} ${s.full}`}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontWeight: 500, fontSize: "0.85rem", color: "var(--text)" }}>
                    <input
                      type="checkbox"
                      checked={form.isento}
                      onChange={e => setForm(f => ({...f, isento: e.target.checked}))}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    Isento de mensalidade
                  </label>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                    Marque para jogadores que não pagam (ex: goleiros). Não serão incluídos nas mensalidades recorrentes.
                  </div>
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
