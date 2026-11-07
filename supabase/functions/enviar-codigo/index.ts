import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function enviarEmailResend(para: string, codigo: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? ""

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PatotaOFC <onboarding@resend.dev>",
      to: [para],
      subject: "Seu código de acesso - PatotaOFC",
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:2rem;">
          <h2 style="color:#0f3460;">PatotaOFC</h2>
          <p>Seu código de verificação é:</p>
          <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.5rem;color:#0f3460;padding:1rem 0;">
            ${codigo}
          </div>
          <p style="color:#888;font-size:0.875rem;">Válido por 10 minutos. Não compartilhe este código.</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Resend error: ${JSON.stringify(err)}`)
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // SEC-03: Rate limit — máximo 5 códigos por hora por e-mail
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("codigos_verificacao")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", umaHoraAtras)

    if ((count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo código." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString()
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Invalidar códigos anteriores
    await supabase
      .from("codigos_verificacao")
      .update({ usado: true })
      .eq("email", email)
      .eq("usado", false)

    // Inserir novo código
    const { error } = await supabase
      .from("codigos_verificacao")
      .insert({ email, codigo, expira_em: expiraEm, usado: false })

    if (error) throw error

    // Enviar e-mail via Resend
    await enviarEmailResend(email, codigo)

    return new Response(
      JSON.stringify({ sucesso: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
