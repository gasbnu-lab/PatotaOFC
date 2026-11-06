import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import type { Session } from "@supabase/supabase-js"

export type Usuario = {
  id: string
  patota_id: number
  patota_slug: string | null
  nome: string
  email: string | null
  role: "admin" | "membro"
  status: "pendente" | "aprovado" | "recusado"
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUsuario(userId: string) {
    const { data } = await supabase
      .from("usuarios")
      .select("*, patota:patota(slug)")
      .eq("id", userId)
      .maybeSingle()
    if (data) {
      const { patota, ...rest } = data as typeof data & { patota?: { slug: string } | null }
      setUsuario({ ...rest, patota_slug: patota?.slug ?? null })
    } else {
      setUsuario(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUsuario(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      if (session) loadUsuario(session.user.id)
      else { setUsuario(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function sair() {
    await supabase.auth.signOut()
  }

  return { session, usuario, loading, sair }
}
