import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function Home() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login")
  }, [navigate])

  function sair() {
    localStorage.removeItem("token")
    navigate("/login")
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
      <h1>Bem-vindo à PatotaOFC! 🎉</h1>
      <p style={{ color: "#555" }}>Login realizado com sucesso.</p>
      <button onClick={sair} style={{ padding: "0.6rem 1.5rem", cursor: "pointer" }}>Sair</button>
    </div>
  )
}
