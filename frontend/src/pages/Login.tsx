import { useState } from "react"
import { useNavigate } from "react-router-dom"
import styles from "./Login.module.css"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

type Etapa = "email" | "codigo"

export default function Login() {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState<Etapa>("email")
  const [email, setEmail] = useState("")
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const res = await fetch(`${FUNCTIONS_URL}/enviar-codigo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEtapa("codigo")
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const res = await fetch(`${FUNCTIONS_URL}/verificar-codigo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      localStorage.setItem("token", json.token)
      navigate("/home")
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.titulo}>PatotaOFC</h1>

        {etapa === "email" ? (
          <form onSubmit={enviarCodigo} className={styles.form}>
            <label htmlFor="email" className={styles.label}>
              Seu e-mail
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <p className={styles.dica}>Você receberá um código de 6 dígitos no seu e-mail</p>
            {erro && <p className={styles.erro}>{erro}</p>}
            <button type="submit" className={styles.botao} disabled={carregando}>
              {carregando ? "Enviando..." : "Receber código"}
            </button>
          </form>
        ) : (
          <form onSubmit={verificarCodigo} className={styles.form}>
            <p className={styles.subtitulo}>
              Código enviado para <strong>{email}</strong>
            </p>
            <label htmlFor="codigo" className={styles.label}>
              Código de 6 dígitos
            </label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={styles.input}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              required
              autoComplete="one-time-code"
            />
            {erro && <p className={styles.erro}>{erro}</p>}
            <button type="submit" className={styles.botao} disabled={carregando}>
              {carregando ? "Verificando..." : "Entrar"}
            </button>
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => { setEtapa("email"); setErro(null) }}
            >
              Trocar e-mail
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
