import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email, codigo } = await req.json()

    if (!email || !codigo) {
      return new Response(
        JSON.stringify({ error: "E-mail e código são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // SEC-04: Buscar código ativo para verificar tentativas
    const { data: codigosAtivos } = await supabase
      .from("codigos_verificacao")
      .select("id, codigo, tentativas")
      .eq("email", email)
      .eq("usado", false)
      .gt("expira_em", new Date().toISOString())
      .order("expira_em", { ascending: false })
      .limit(1)

    const codigoAtivo = codigosAtivos?.[0]

    // Bloquear se atingiu limite de tentativas
    if (codigoAtivo && codigoAtivo.tentativas >= 5) {
      return new Response(
        JSON.stringify({ error: "Código bloqueado por excesso de tentativas. Solicite um novo código." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { data, error } = await supabase
      .from("codigos_verificacao")
      .select("*")
      .eq("email", email)
      .eq("codigo", codigo)
      .eq("usado", false)
      .gt("expira_em", new Date().toISOString())
      .single()

    if (error || !data) {
      // Incrementar tentativas no código ativo
      if (codigoAtivo) {
        const novasTentativas = codigoAtivo.tentativas + 1
        await supabase
          .from("codigos_verificacao")
          .update({
            tentativas: novasTentativas,
            usado: novasTentativas >= 5,
          })
          .eq("id", codigoAtivo.id)
      }

      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Marcar código como usado
    await supabase
      .from("codigos_verificacao")
      .update({ usado: true })
      .eq("id", data.id)

    // Gerar JWT
    const jwtSecret = Deno.env.get("JWT_SECRET") ?? ""
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    )

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      {
        sub: email,
        email,
        role: "authenticated",
        iat: getNumericDate(0),
        exp: getNumericDate(60 * 60 * 24 * 7),
      },
      key
    )

    return new Response(
      JSON.stringify({ sucesso: true, token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
