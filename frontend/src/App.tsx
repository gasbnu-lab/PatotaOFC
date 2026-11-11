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
import Convidados from "./pages/admin/Convidados"
import Churrascos from "./pages/admin/Churrascos"
import ChurrascoPublico from "./pages/ChurrascoPublico"
import Financeiro from "./pages/admin/Financeiro"
import Config from "./pages/admin/Config"
import Perfil from "./pages/admin/Perfil"
import Sorteio from "./pages/admin/Sorteio"
import Ranking from "./pages/admin/Ranking"
import SorteioPublico from "./pages/SorteioPublico"
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
        <Route path="/p/:slug/sorteio" element={<SorteioPublico />} />
        <Route path="/p/:slug/churrasco/:churrasco_id" element={<ChurrascoPublico />} />
        <Route path="/login" element={<Login />} />
        <Route path="/aguardando" element={<Aguardando />} />
        <Route path="/home" element={<Home />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="jogadores" element={<Jogadores />} />
          <Route path="jogos" element={<Jogos />} />
          <Route path="sorteio" element={<Sorteio />} />
          <Route path="convidados" element={<Convidados />} />
          <Route path="mensalidades" element={<Mensalidades />} />
          <Route path="churrascos" element={<Churrascos />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="config" element={<Config />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>
      </Routes>
    </>
  )
}
