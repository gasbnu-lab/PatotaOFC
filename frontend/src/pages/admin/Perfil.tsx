import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import type { Usuario } from "../../lib/useAuth"
import s from "../admin/admin.module.css"
import ps from "./Perfil.module.css"

type Ctx = { usuario: Usuario; nomeTime: string }

export default function Perfil() {
  const { usuario, nomeTime } = useOutletContext<Ctx>()

  const [nome, setNome] = useState(usuario.nome)
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [msgNome, setMsgNome] = useState<{ ok: boolean; txt: string } | null>(null)

  const [senhaAtual, setSenhaAtual] = useState("")
  const [senhaNova, setSenhaNova] = useState("")
  const [senhaConf, setSenhaConf] = useState("")
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [msgSenha, setMsgSenha] = useState<{ ok: boolean; txt: string } | null>(null)

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSalvandoNome(true)
    setMsgNome(null)
    const { error } = await supabase
      .from("usuarios")
      .update({ nome: nome.trim() })
      .eq("id", usuario.id)
    setSalvandoNome(false)
    setMsgNome(error ? { ok: false, txt: "Erro ao salvar nome." } : { ok: true, txt: "Nome atualizado!" })
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault()
    setMsgSenha(null)
    if (senhaNova.length < 6) {
      setMsgSenha({ ok: false, txt: "Nova senha deve ter pelo menos 6 caracteres." })
      return
    }
    if (senhaNova !== senhaConf) {
      setMsgSenha({ ok: false, txt: "As senhas não coincidem." })
      return
    }
    setSalvandoSenha(true)
    // Reautentica com senha atual para confirmar identidade
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setMsgSenha({ ok: false, txt: "Sessão inválida. Faça login novamente." })
      setSalvandoSenha(false)
      return
    }
    const { error: errLogin } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senhaAtual,
    })
    if (errLogin) {
      setMsgSenha({ ok: false, txt: "Senha atual incorreta." })
      setSalvandoSenha(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: senhaNova })
    setSalvandoSenha(false)
    if (error) {
      setMsgSenha({ ok: false, txt: error.message })
    } else {
      setMsgSenha({ ok: true, txt: "Senha alterada com sucesso!" })
      setSenhaAtual("")
      setSenhaNova("")
      setSenhaConf("")
    }
  }

  function iniciais(n: string) {
    const p = n.trim().split(" ")
    return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase()
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.pageTitulo}>Meu perfil</div>
          <div className={s.pageSubtitulo}>{nomeTime}</div>
        </div>
      </div>

      {/* Avatar + info */}
      <div className={ps.avatarCard}>
        <div className={ps.avatar}>{iniciais(usuario.nome)}</div>
        <div>
          <div className={ps.avatarNome}>{usuario.nome}</div>
          <div className={ps.avatarEmail}>{usuario.email ?? "—"}</div>
          <span className={ps.badge}>{usuario.role === "admin" ? "Admin" : "Membro"}</span>
        </div>
      </div>

      {/* Editar nome */}
      <div className={ps.card}>
        <div className={ps.cardTitulo}>Editar nome</div>
        <form onSubmit={salvarNome} className={ps.form}>
          <input
            className={ps.input}
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome completo"
            required
          />
          {msgNome && (
            <div className={msgNome.ok ? ps.msgOk : ps.msgErro}>{msgNome.txt}</div>
          )}
          <button className={ps.btnSalvar} type="submit" disabled={salvandoNome || nome.trim() === usuario.nome}>
            {salvandoNome ? "Salvando..." : "Salvar nome"}
          </button>
        </form>
      </div>

      {/* Trocar senha */}
      <div className={ps.card}>
        <div className={ps.cardTitulo}>Trocar senha</div>
        <form onSubmit={trocarSenha} className={ps.form}>
          <div>
            <label className={ps.label}>Senha atual</label>
            <input
              className={ps.input}
              type="password"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={ps.label}>Nova senha</label>
            <input
              className={ps.input}
              type="password"
              value={senhaNova}
              onChange={e => setSenhaNova(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={ps.label}>Confirmar nova senha</label>
            <input
              className={ps.input}
              type="password"
              value={senhaConf}
              onChange={e => setSenhaConf(e.target.value)}
              placeholder="Repita a nova senha"
              required
              autoComplete="new-password"
            />
          </div>
          {msgSenha && (
            <div className={msgSenha.ok ? ps.msgOk : ps.msgErro}>{msgSenha.txt}</div>
          )}
          <button className={ps.btnSalvar} type="submit" disabled={salvandoSenha || !senhaAtual || !senhaNova || !senhaConf}>
            {salvandoSenha ? "Alterando..." : "Trocar senha"}
          </button>
        </form>
      </div>

      {/* Info patota */}
      <div className={ps.card}>
        <div className={ps.cardTitulo}>Sua patota</div>
        <div className={ps.infoRow}>
          <span className={ps.infoLabel}>Time</span>
          <span className={ps.infoVal}>{nomeTime}</span>
        </div>
        <div className={ps.infoRow}>
          <span className={ps.infoLabel}>Função</span>
          <span className={ps.infoVal}>{usuario.role === "admin" ? "Administrador" : "Membro"}</span>
        </div>
        <div className={ps.infoRow}>
          <span className={ps.infoLabel}>Status</span>
          <span className={ps.infoVal}>{usuario.status === "aprovado" ? "✅ Aprovado" : usuario.status}</span>
        </div>
      </div>
    </div>
  )
}
