import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

// --- Tipos ----------------------------------------------------------------

type Lancamento = {
  id: string
  tipo: string
  valor: number
  descricao: string
  data: string
  criado_em: string
}

type Mensalidade = {
  id: string
  pago: boolean
  valor: number
  mes_ref: string
  jogadores: { nome: string; plano_mensalidade: string | null } | null
}

type Resumo = {
  entradas: number
  saidas: number
  saldo: number
  mensPagas: number
  mensPendentes: number
  mensAtrasadas: number
  valorPago: number
  valorPendente: number
  valorAtrasado: number
}

// --- Helpers ---------------------------------------------------------------

function statusMens(mes_ref: string, pago: boolean): "pago" | "pendente" | "atrasado" {
  if (pago) return "pago"
  const [ano, mes] = mes_ref.split("-").map(Number)
  const venc = new Date(ano, mes - 1, 9)
  return new Date() > venc ? "atrasado" : "pendente"
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtMes(yyyyMM: string): string {
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
  const mes = parseInt(yyyyMM.split("-")[1]) - 1
  return `${nomes[mes]}/${yyyyMM.split("-")[0]}`
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return ""
  const s = String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function gerarCsvLancamentos(lancamentos: Lancamento[]): string {
  const linhas = ["Data,Tipo,Descrição,Valor"]
  for (const l of lancamentos) {
    linhas.push([
      csvEscape(l.data),
      csvEscape(l.tipo === "entrada" ? "Entrada" : "Saída"),
      csvEscape(l.descricao),
      csvEscape(l.valor.toFixed(2)),
    ].join(","))
  }
  return linhas.join("\n")
}

function gerarCsvMensalidades(mensalidades: Mensalidade[], mes: string): string {
  const linhas = ["Jogador,Plano,Valor,Status"]
  for (const m of mensalidades) {
    const nome = m.jogadores?.nome ?? "—"
    const plano = m.jogadores?.plano_mensalidade ?? "—"
    const st = statusMens(mes + "-01", m.pago)
    linhas.push([
      csvEscape(nome),
      csvEscape(plano === "com_churrasco" ? "Com churrasco" : plano === "sem_churrasco" ? "Sem churrasco" : plano),
      csvEscape(m.valor.toFixed(2)),
      csvEscape(st === "pago" ? "Pago" : st === "atrasado" ? "Atrasado" : "Pendente"),
    ].join(","))
  }
  return linhas.join("\n")
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function htmlEmail(patotaNome: string, mes: string, r: Resumo): string {
  const mesFmt = fmtMes(mes)
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório ${mesFmt} — ${patotaNome}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem;color:#1f2937;">
  <h2 style="color:#0f3460;margin-bottom:0.25rem;">📊 Relatório Financeiro</h2>
  <p style="color:#6b7280;margin-top:0;">${patotaNome} · ${mesFmt}</p>

  <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse:collapse;margin:1rem 0;border-radius:8px;overflow:hidden;">
    <tr style="background:#f0fdf4;">
      <td style="border:1px solid #d1fae5;font-weight:600;">💰 Saldo do mês</td>
      <td style="border:1px solid #d1fae5;text-align:right;font-weight:700;font-size:1.1rem;color:${r.saldo >= 0 ? "#16a34a" : "#dc2626"};">${fmtBRL(r.saldo)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;">↑ Entradas</td>
      <td style="border:1px solid #e5e7eb;text-align:right;color:#16a34a;font-weight:600;">${fmtBRL(r.entradas)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;">↓ Saídas</td>
      <td style="border:1px solid #e5e7eb;text-align:right;color:#dc2626;font-weight:600;">${fmtBRL(r.saidas)}</td>
    </tr>
  </table>

  <h3 style="color:#0f3460;margin-top:1.5rem;">Mensalidades — ${mesFmt}</h3>
  <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse;">
    <tr style="background:#f9fafb;">
      <th style="border:1px solid #e5e7eb;text-align:left;">Status</th>
      <th style="border:1px solid #e5e7eb;text-align:right;">Qtd.</th>
      <th style="border:1px solid #e5e7eb;text-align:right;">Total</th>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;color:#16a34a;font-weight:600;">✅ Pagas</td>
      <td style="border:1px solid #e5e7eb;text-align:right;">${r.mensPagas}</td>
      <td style="border:1px solid #e5e7eb;text-align:right;">${fmtBRL(r.valorPago)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;color:#d97706;font-weight:600;">⏳ Pendentes</td>
      <td style="border:1px solid #e5e7eb;text-align:right;">${r.mensPendentes}</td>
      <td style="border:1px solid #e5e7eb;text-align:right;">${fmtBRL(r.valorPendente)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb;color:#dc2626;font-weight:600;">⚠️ Atrasadas</td>
      <td style="border:1px solid #e5e7eb;text-align:right;">${r.mensAtrasadas}</td>
      <td style="border:1px solid #e5e7eb;text-align:right;">${fmtBRL(r.valorAtrasado)}</td>
    </tr>
  </table>

  <p style="font-size:0.8rem;color:#9ca3af;margin-top:2rem;">
    Dados exportados em CSV em anexo. Este e-mail foi gerado automaticamente pelo PatotaOFC.
  </p>
</body>
</html>`
}

// --- Envio via Resend -------------------------------------------------------

async function enviarEmail(
  destinatarios: string[],
  assunto: string,
  html: string,
  csvLanc: string,
  csvMens: string,
  mes: string,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? ""
  const payload = {
    from: "PatotaOFC <onboarding@resend.dev>",
    to: destinatarios,
    subject: assunto,
    html,
    attachments: [
      {
        filename: `lancamentos-${mes}.csv`,
        content: toBase64(csvLanc),
      },
      {
        filename: `mensalidades-${mes}.csv`,
        content: toBase64(csvMens),
      },
    ],
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Resend error: ${JSON.stringify(err)}`)
  }
}

// --- Handler principal -----------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  try {
    // Autenticação: session do usuário OU cron_secret para chamadas internas
    const cronSecret = req.headers.get("x-cron-secret")
    const cronSecretEnv = Deno.env.get("CRON_SECRET") ?? ""
    const authHeader = req.headers.get("authorization") ?? ""

    const isCronCall = cronSecret && cronSecretEnv && cronSecret === cronSecretEnv
    const isUserCall = authHeader.startsWith("Bearer ")

    if (!isCronCall && !isUserCall) {
      return json({ error: "Não autorizado." }, 401)
    }

    const body = await req.json()
    const patotaId: number = body.patota_id
    if (!patotaId) return json({ error: "patota_id obrigatório." }, 400)

    // Mês a reportar: parâmetro ou mês anterior (padrão para cron do dia 1)
    let mes: string = body.mes_ref ?? ""
    if (!mes) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - 1)
      mes = d.toISOString().slice(0, 7) // YYYY-MM
    }
    const mesInicio = mes + "-01"
    const d = new Date(mesInicio)
    d.setMonth(d.getMonth() + 1)
    const mesFim = d.toISOString().split("T")[0]

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Para chamadas de usuário: validar que é admin da patota
    if (isUserCall && !isCronCall) {
      const token = authHeader.replace("Bearer ", "")
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return json({ error: "Sessão inválida." }, 401)
      const { data: us } = await supabase
        .from("usuarios")
        .select("role, patota_id")
        .eq("id", user.id)
        .maybeSingle()
      if (!us || us.role !== "admin" || us.patota_id !== patotaId) {
        return json({ error: "Sem permissão para esta patota." }, 403)
      }
    }

    // Buscar dados da patota
    const { data: patota } = await supabase
      .from("patota")
      .select("id, nome")
      .eq("id", patotaId)
      .maybeSingle()
    if (!patota) return json({ error: "Patota não encontrada." }, 404)

    // Lançamentos do mês
    const { data: lancamentos } = await supabase
      .from("lancamentos")
      .select("id, tipo, valor, descricao, data, criado_em")
      .eq("patota_id", patotaId)
      .gte("data", mesInicio)
      .lt("data", mesFim)
      .order("data", { ascending: true })

    // Mensalidades do mês
    const { data: mensalidades } = await supabase
      .from("mensalidades")
      .select("id, pago, valor, mes_ref, jogadores(nome, plano_mensalidade)")
      .eq("patota_id", patotaId)
      .gte("mes_ref", mesInicio)
      .lt("mes_ref", mesFim)

    // Admins da patota
    const { data: admins } = await supabase
      .from("usuarios")
      .select("email")
      .eq("patota_id", patotaId)
      .eq("role", "admin")
      .eq("status", "aprovado")

    const lancs: Lancamento[] = (lancamentos ?? []) as Lancamento[]
    const mens: Mensalidade[] = (mensalidades ?? []) as unknown as Mensalidade[]

    // Calcular resumo
    const entradas = lancs.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0)
    const saidas = lancs.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0)
    const resumo: Resumo = {
      entradas,
      saidas,
      saldo: entradas - saidas,
      mensPagas: 0,
      mensPendentes: 0,
      mensAtrasadas: 0,
      valorPago: 0,
      valorPendente: 0,
      valorAtrasado: 0,
    }
    for (const m of mens) {
      const st = statusMens(m.mes_ref, m.pago)
      if (st === "pago") { resumo.mensPagas++; resumo.valorPago += Number(m.valor) }
      else if (st === "pendente") { resumo.mensPendentes++; resumo.valorPendente += Number(m.valor) }
      else { resumo.mensAtrasadas++; resumo.valorAtrasado += Number(m.valor) }
    }

    // Destinatários: admins + backup fixo
    const emailsAdmins = (admins ?? []).map(a => a.email).filter(Boolean) as string[]
    const destinatarios = [...new Set([...emailsAdmins, "gasbnu@gmail.com"])]

    if (destinatarios.length === 0) {
      return json({ error: "Nenhum destinatário encontrado." }, 400)
    }

    const assunto = `📊 Relatório Financeiro ${fmtMes(mes)} — ${patota.nome}`
    const html = htmlEmail(patota.nome, mes, resumo)
    const csvLanc = gerarCsvLancamentos(lancs)
    const csvMens = gerarCsvMensalidades(mens, mes)

    await enviarEmail(destinatarios, assunto, html, csvLanc, csvMens, mes)

    return json({
      sucesso: true,
      mes,
      destinatarios,
      lancamentos: lancs.length,
      mensalidades: mens.length,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
