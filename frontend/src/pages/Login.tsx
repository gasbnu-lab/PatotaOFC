import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import s from "./Login.module.css"

type Patota = { id: number; nome: string }
type Aba = "entrar" | "cadastrar"
type Etapa = "dados" | "email_enviado" | "escolher_patota"

export default function Login() {
  const navigate = useNavigate()
  const [aba, setAba] = useState<Aba>("entrar")
  const [etapa, setEtapa] = useState<Etapa>("dados")

  // Campos entrar
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")

  // Campos cadastrar
  const [nome, setNome] = useState("")
  const [emailCad, setEmailCad] = useState("")
  const [senhaCad, setSenhaCad] = useState("")

  // Seletor de patota (pós-confirmação)
  const [patatoas, setPatotas] = useState<Patota[]>([])
  const [patotatId, setPatotaId] = useState("")
  const [nomeConfirmado, setNomeConfirmado] = useState("")
  const [emailConfirmado, setEmailConfirmado] = useState("")

  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    supabase.from("patota").select("id, nome").order("nome").then(({ data }) => {
      setPatotas(data ?? [])
      if (data && data.length > 0) setPatotaId(String(data[0].id))
    })
  }, [])

  // Detecta retorno do link de confirmação ou login Google
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
        const { data: usuario } = await supabase
          .from("usuarios")
          .select("id, status, role")
          .eq("id", session.user.id)
          .maybeSingle()

        if (!usuario) {
          // Usuário autenticado mas sem registro → precisa escolher patota
          setNomeConfirmado(session.user.user_metadata?.full_name ?? "")
          setEmailConfirmado(session.user.email ?? "")
          setAba("cadastrar")
          setEtapa("escolher_patota")
          setCarregando(false)
          return
        }

        if (usuario.status === "pendente") navigate("/aguardando")
        else if (usuario.status === "recusado") {
          setErro("Seu acesso foi recusado pelo administrador.")
          await supabase.auth.signOut()
        } else if (usuario.status === "aprovado" && usuario.role === "admin") navigate("/admin")
        else navigate("/")
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // ── Entrar ──────────────────────────────────────────────────────────────────

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message)
      setCarregando(false)
    }
    // onAuthStateChange redireciona se ok
  }

  // ── Cadastrar: passo 1 (dados) ───────────────────────────────────────────────

  async function enviarCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signUp({
      email: emailCad,
      password: senhaCad,
      options: {
        data: { full_name: nome.trim() || emailCad.split("@")[0] },
        emailRedirectTo: window.location.origin + "/login",
      },
    })
    if (error) {
      setErro(error.message === "User already registered" ? "Este e-mail já está cadastrado. Tente entrar." : error.message)
      setCarregando(false)
      return
    }
    setEtapa("email_enviado")
    setCarregando(false)
  }

  // ── Cadastrar: passo 3 (escolher patota, pós-confirmação) ────────────────────

  async function completarCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!patotatId) { setErro("Selecione a sua patota."); return }
    setCarregando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Sessão expirada. Tente entrar novamente.")

      const pid = parseInt(patotatId)
      const { count } = await supabase
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .eq("patota_id", pid)

      const role = (count ?? 0) === 0 ? "admin" : "membro"
      const status = role === "admin" ? "aprovado" : "pendente"

      const { error } = await supabase.from("usuarios").insert({
        id: session.user.id,
        patota_id: pid,
        nome: nomeConfirmado || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "",
        email: emailConfirmado || session.user.email,
        role,
        status,
      })
      if (error) throw error

      if (role === "admin") navigate("/admin")
      else navigate("/aguardando")
    } catch (err: unknown) {
      setErro((err as { message?: string }).message ?? "Erro ao finalizar cadastro.")
      setCarregando(false)
    }
  }

  async function entrarGoogle() {
    setErro(null)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/login" },
    })
  }

  function trocarAba(a: Aba) {
    setAba(a)
    setErro(null)
    setEtapa("dados")
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.logo}>
        <div className={s.logoBadge}>P</div>
        <div className={s.logoNome}>PATOTAOFC</div>
      </div>

      <div className={s.card}>
        {/* Tabs — ocultas quando está no passo pós-confirmação */}
        {etapa !== "escolher_patota" && (
          <div className={s.tabs}>
            <button className={`${s.tab} ${aba === "entrar" ? s.tabAtivo : ""}`} onClick={() => trocarAba("entrar")}>
              Entrar
            </button>
            <button className={`${s.tab} ${aba === "cadastrar" ? s.tabAtivo : ""}`} onClick={() => trocarAba("cadastrar")}>
              Cadastrar
            </button>
          </div>
        )}

        {/* ── ENTRAR ── */}
        {aba === "entrar" && (
          <form className={s.form} onSubmit={entrar}>
            <div>
              <label className={s.label}>E-mail</label>
              <input className={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" required autoComplete="email" />
            </div>
            <div>
              <label className={s.label}>Senha</label>
              <input className={s.input} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            {erro && <div className={s.erro}>{erro}</div>}
            <button className={s.btnPrimary} type="submit" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
            <div className={s.divider}>ou</div>
            <button type="button" className={s.btnGoogle} onClick={entrarGoogle}>
              <GoogleIcon />
              Entrar com Google
            </button>
          </form>
        )}

        {/* ── CADASTRAR: passo 1 — dados ── */}
        {aba === "cadastrar" && etapa === "dados" && (
          <form className={s.form} onSubmit={enviarCadastro}>
            <div>
              <label className={s.label}>Nome</label>
              <input className={s.input} type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div>
              <label className={s.label}>E-mail</label>
              <input className={s.input} type="email" value={emailCad} onChange={e => setEmailCad(e.target.value)} placeholder="voce@email.com" required autoComplete="email" />
            </div>
            <div>
              <label className={s.label}>Senha</label>
              <input className={s.input} type="password" value={senhaCad} onChange={e => setSenhaCad(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} autoComplete="new-password" />
            </div>
            {erro && <div className={s.erro}>{erro}</div>}
            <button className={s.btnPrimary} type="submit" disabled={carregando}>
              {carregando ? "Enviando..." : "Criar conta"}
            </button>
            <div className={s.divider}>ou</div>
            <button type="button" className={s.btnGoogle} onClick={entrarGoogle}>
              <GoogleIcon />
              Cadastrar com Google
            </button>
          </form>
        )}

        {/* ── CADASTRAR: passo 2 — aguardando confirmação ── */}
        {aba === "cadastrar" && etapa === "email_enviado" && (
          <div className={s.form} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem" }}>📬</div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#111" }}>Verifique seu e-mail</p>
            <p style={{ color: "#666", fontSize: "0.88rem", lineHeight: 1.6 }}>
              Enviamos um link de confirmação para <strong>{emailCad}</strong>.
              Clique no link para continuar o cadastro.
            </p>
            <p className={s.hint} style={{ marginTop: "0.5rem" }}>Não recebeu? Verifique a pasta de spam.</p>
            <button
              type="button"
              style={{ marginTop: "0.5rem", background: "none", border: "none", color: "#888", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => { setEtapa("dados"); setErro(null) }}
            >
              Trocar e-mail
            </button>
          </div>
        )}

        {/* ── CADASTRAR: passo 3 — escolher patota (pós-confirmação) ── */}
        {etapa === "escolher_patota" && (
          <form className={s.form} onSubmit={completarCadastro}>
            <div style={{ textAlign: "center", paddingBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>🎉</div>
              <p style={{ fontWeight: 700, color: "#111", fontSize: "0.95rem" }}>
                Bem-vindo{nomeConfirmado ? `, ${nomeConfirmado.split(" ")[0]}` : ""}!
              </p>
              <p style={{ color: "#666", fontSize: "0.84rem" }}>Agora escolha a sua patota para finalizar.</p>
            </div>
            <div>
              <label className={s.label}>Qual é a sua patota?</label>
              <select className={s.select} value={patotatId} onChange={e => setPatotaId(e.target.value)} required>
                <option value="">Selecione...</option>
                {patatoas.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.nome}</option>
                ))}
              </select>
            </div>
            {erro && <div className={s.erro}>{erro}</div>}
            <button className={s.btnPrimary} type="submit" disabled={carregando}>
              {carregando ? "Finalizando..." : "Entrar na patota"}
            </button>
            <p className={s.hint}>O administrador precisará aprovar o seu acesso.</p>
          </form>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
