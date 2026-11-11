import { useEffect, useState } from "react"
import { useNavigate, useLocation, Outlet } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../lib/useAuth"
import styles from "./Layout.module.css"

const NAV = [
  { path: "/admin", label: "Visão geral", icon: "📊" },
  { path: "/admin/jogadores", label: "Jogadores", icon: "👥" },
  { path: "/admin/jogos", label: "Jogos", icon: "⚽" },
  { path: "/admin/sorteio", label: "Sorteio", icon: "🎲" },
  { path: "/admin/convidados", label: "Convidados", icon: "🎟️" },
  { path: "/admin/mensalidades", label: "Mensalidades", icon: "💰" },
  { path: "/admin/churrascos", label: "Churrascos", icon: "🥩" },
  { path: "/admin/financeiro", label: "Financeiro", icon: "📋" },
  { path: "/admin/ranking", label: "Ranking", icon: "🏆" },
]

const NAV_BOTTOM = [
  { path: "/admin/config", label: "Config. patota", icon: "⚙️" },
  { path: "/admin/perfil", label: "Meu perfil", icon: "👤" },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, usuario, loading, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [nomeTime, setNomeTime] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session) { navigate("/login"); return }
    if (!usuario) return
    if (usuario.status === "pendente") { navigate("/aguardando"); return }
    if (usuario.status === "recusado") { navigate("/login"); return }
    if (usuario.role !== "admin") { navigate("/"); return }
  }, [loading, session, usuario, navigate])

  useEffect(() => {
    if (!usuario?.patota_id) return
    supabase.from("patota").select("nome, logo_url").eq("id", usuario.patota_id).maybeSingle().then(({ data }) => {
      if (data?.nome) setNomeTime(data.nome)
      setLogoUrl(data?.logo_url ?? null)
    })
  }, [usuario?.patota_id])

  async function handleSair() {
    await sair()
    navigate("/login")
  }

  const isAtivo = (path: string) =>
    path === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(path)

  if (loading || !usuario) return null

  return (
    <div className={styles.shell}>
      {/* Header mobile */}
      <header className={styles.header}>
        <button className={styles.menuBtn} onClick={() => setMenuAberto(v => !v)}>☰</button>
        {logoUrl
          ? <img src={logoUrl} alt={nomeTime} className={styles.headerLogo} style={{ objectFit: "contain", borderRadius: 6 }} />
          : <div className={styles.headerLogo}>P</div>}
        <div className={styles.headerTitulo}>
          <span className={styles.headerAppNome}>PATOTAOFC</span>
          {nomeTime && <span className={styles.headerNomeTime}>{nomeTime}</span>}
        </div>
        <button className={styles.sairBtnMobile} onClick={handleSair}>Sair</button>
      </header>

      <div className={styles.body}>
        {/* Sidebar */}
        <nav className={`${styles.sidebar} ${menuAberto ? styles.sidebarAberta : ""}`}>
          <div className={styles.sidebarTopo}>
            {logoUrl
              ? <img src={logoUrl} alt={nomeTime} className={styles.sidebarLogo} style={{ objectFit: "contain", borderRadius: 6 }} />
              : <div className={styles.sidebarLogo}>P</div>}
            <div className={styles.sidebarTitulos}>
              <div className={styles.sidebarAppNome}>PATOTAOFC</div>
              {nomeTime && <div className={styles.sidebarNomeTime}>{nomeTime}</div>}
            </div>
          </div>

          {NAV.map(item => (
            <button
              key={item.path}
              className={`${styles.navItem} ${isAtivo(item.path) ? styles.navAtivo : ""}`}
              onClick={() => { navigate(item.path); setMenuAberto(false) }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <div className={styles.navRodape}>
            {NAV_BOTTOM.map(item => (
              <button
                key={item.path}
                className={`${styles.navItem} ${isAtivo(item.path) ? styles.navAtivo : ""}`}
                onClick={() => { navigate(item.path); setMenuAberto(false) }}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            <button className={styles.navSair} onClick={handleSair}>
              <span className={styles.navIcon}>↩</span>
              <span>Sair</span>
            </button>
          </div>
        </nav>

        {menuAberto && <div className={styles.overlay} onClick={() => setMenuAberto(false)} />}

        <main className={styles.conteudo}>
          <Outlet context={{ usuario, nomeTime }} />
        </main>
      </div>
    </div>
  )
}
