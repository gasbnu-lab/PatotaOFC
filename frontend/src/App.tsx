import { useEffect } from "react"
import { Routes, Route, useNavigate } from "react-router-dom"
import Login from "./pages/Login"
import Aguardando from "./pages/Aguardando"
import Home from "./pages/Home"
import Publica from "./pages/Publica"
import AdminLayout from "./pages/admin/Layout"
import Dashboard from "./pages/admin/Dashboard"
import Jogadores from "./pages/admin/Jogadores"
import Jogos from "./pages/admin/Jogos"
import Mensalidades from "./pages/admin/Mensalidades"
import { SorteioPage, ConvidadosPage, ChurrascosPage, FinanceiroPage, ConfigPage } from "./pages/admin/Stub"
import Perfil from "./pages/admin/Perfil"
import { useAuth } from "./lib/useAuth"

function AuthRedirect() {
  const { session, usuario, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && session && usuario === null) {
      navigate("/login")
    }
  }, [loading, session, usuario, navigate])

  return null
}

function HomeRedirect() {
  const { session, usuario, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!session) {
      navigate("/login", { replace: true })
    } else if (usuario?.patota_slug) {
      navigate(`/p/${usuario.patota_slug}`, { replace: true })
    } else if (usuario?.patota_id && !usuario.patota_slug) {
      navigate(`/p/${usuario.patota_id}`, { replace: true })
    } else if (usuario === null && session) {
      navigate("/login", { replace: true })
    }
  }, [loading, session, usuario, navigate])

  return null
}

export default function App() {
  return (
    <>
      <AuthRedirect />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/p/:slug" element={<Publica />} />
        <Route path="/login" element={<Login />} />
        <Route path="/aguardando" element={<Aguardando />} />
        <Route path="/home" element={<Home />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="jogadores" element={<Jogadores />} />
          <Route path="jogos" element={<Jogos />} />
          <Route path="sorteio" element={<SorteioPage />} />
          <Route path="convidados" element={<ConvidadosPage />} />
          <Route path="mensalidades" element={<Mensalidades />} />
          <Route path="churrascos" element={<ChurrascosPage />} />
          <Route path="financeiro" element={<FinanceiroPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>
      </Routes>
    </>
  )
}
