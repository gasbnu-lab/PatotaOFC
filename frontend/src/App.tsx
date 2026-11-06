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
import { useAuth } from "./lib/useAuth"

// Detecta usuário autenticado mas sem registro em usuarios (ex: após Google OAuth)
// e redireciona para /login completar o cadastro (escolher patota)
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

export default function App() {
  return (
    <>
      <AuthRedirect />
      <Routes>
        <Route path="/" element={<Publica />} />
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
        </Route>
      </Routes>
    </>
  )
}
