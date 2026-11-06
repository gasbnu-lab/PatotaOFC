import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"
import s from "./Login.module.css"

export default function Aguardando() {
  const navigate = useNavigate()

  async function sair() {
    await supabase.auth.signOut()
    navigate("/login")
  }

  return (
    <div className={s.page}>
      <div className={s.logo}>
        <div className={s.logoBadge}>P</div>
        <div className={s.logoNome}>PATOTAOFC</div>
      </div>

      <div className={s.card}>
        <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111", marginBottom: "0.5rem" }}>
            Aguardando aprovação
          </h2>
          <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            Seu cadastro foi recebido! O administrador da sua patota precisa aprovar o seu acesso antes de você entrar.
          </p>
          <p style={{ color: "#999", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
            Assim que for aprovado, entre novamente com seu e-mail e senha.
          </p>
          <button
            onClick={sair}
            style={{
              width: "100%",
              padding: "0.72rem",
              background: "#f0f0f0",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              color: "#555",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
