import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import type { Usuario } from "../../lib/useAuth"
import s from "./admin.module.css"
import f from "./Financeiro.module.css"

type Ctx = { usuario: Usuario; nomeTime: string }

type Jogo = { id: string; data: string; horario: string; local: string }

type Convidado = {
  id: string
  nome_convidado: string
  convidado_por_id: string | null
  confirmado: boolean
  posicao: string | null
  rating_habilidade: number | null
  convidado_por?: { nome: string } | null
}

function fmtData(iso: string) {
  const [a, m, d] = iso.split("-")
  return `${d}/${m}/${a}`
}

const posicaoLabel: Record<string, string> = { goleiro: "Goleiro", linha: "Linha", qualquer: "Qualquer" }

export default function Convidados() {
  const { usuario } = useOutletContext<Ctx>()
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [jogoSel, setJogoSel] = useState<string>("")
  const [convidados, setConvidados] = useState<Convidado[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingConv, setLoadingConv] = useState(false)
  const [recusarConfirmId, setRecusarConfirmId] = useState<string | null>(null)

  // form adicionar convidado
  const [formAberto, setFormAberto] = useState(false)
  const [fNome, setFNome] = useState("")
  const [fPosicao, setFPosicao] = useState("qualquer")
  const [fRating, setFRating] = useState(5)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)

  // form editar
  const [editId, setEditId] = useState<string | null>(null)
  const [ePosicao, setEPosicao] = useState("qualquer")
  const [eRating, setERating] = useState(5)
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  useEffect(() => { carregarJogos() }, [])
  useEffect(() => { if (jogoSel) carregarConvidados(jogoSel) }, [jogoSel])

  async function carregarJogos() {
    setLoading(true)
    const hoje = new Date().toISOString().split("T")[0]
    const { data } = await supabase
      .from("jogos")
      .select("id, data, horario, local")
      .eq("patota_id", usuario.patota_id)
      .gte("data", hoje)
      .in("status", ["agendado", "confirmado"])
      .order("data")
      .limit(10)
    const lista = data ?? []
    setJogos(lista)
    if (lista.length > 0) setJogoSel(lista[0].id)
    else setLoading(false)
  }

  async function carregarConvidados(jid: string) {
    setLoadingConv(true)
    const { data } = await supabase
      .from("presencas")
      .select("id, nome_convidado, convidado_por_id, confirmado, posicao, rating_habilidade, jogadores:convidado_por_id(nome)")
      .eq("jogo_id", jid)
      .eq("convidado", true)
      .order("criado_em")
    setConvidados((data ?? []) as unknown as Convidado[])
    setLoadingConv(false)
    setLoading(false)
  }

  async function aprovar(id: string, confirmar: boolean) {
    await supabase.from("presencas").update({ confirmado: confirmar }).eq("id", id)
    if (jogoSel) carregarConvidados(jogoSel)
  }

  async function recusar(id: string) {
    await supabase.from("presencas").delete().eq("id", id)
    if (jogoSel) carregarConvidados(jogoSel)
  }

  async function adicionarConvidado(e: React.FormEvent) {
    e.preventDefault()
    if (!jogoSel) return
    setErroForm(null)
    if (!fNome.trim()) { setErroForm("Nome obrigatório."); return }
    setSalvando(true)
    const { error } = await supabase.from("presencas").insert({
      jogo_id: jogoSel,
      nome_convidado: fNome.trim(),
      convidado: true,
      confirmado: true,
      posicao: fPosicao,
      rating_habilidade: fRating,
      patota_id: usuario.patota_id,
    })
    setSalvando(false)
    if (error) { setErroForm(`Erro: ${error.message}`); return }
    setFormAberto(false)
    setFNome(""); setFPosicao("qualquer"); setFRating(5)
    carregarConvidados(jogoSel)
  }

  function iniciarEditar(c: Convidado) {
    setEditId(c.id)
    setEPosicao(c.posicao ?? "qualquer")
    setERating(c.rating_habilidade ?? 5)
  }

  async function salvarEdicao(id: string) {
    setSalvandoEdit(true)
    await supabase.from("presencas").update({ posicao: ePosicao, rating_habilidade: eRating }).eq("id", id)
    setSalvandoEdit(false)
    setEditId(null)
    if (jogoSel) carregarConvidados(jogoSel)
  }

  const pendentes = convidados.filter(c => !c.confirmado)
  const aprovados = convidados.filter(c => c.confirmado)
  const jogoAtual = jogos.find(j => j.id === jogoSel)

  if (loading) return (
    <div className={s.page}>
      <div className={s.pageHeader}><div className={s.pageTitulo}>Convidados</div></div>
      <div className={f.spinner} />
    </div>
  )

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <div className={s.pageTitulo}>Convidados</div>
          <div className={s.pageSubtitulo}>Gerencie convidados por jogo</div>
        </div>
        {jogoSel && (
          <button className={f.btnNovo} onClick={() => { setFormAberto(v => !v); setErroForm(null) }}>
            {formAberto ? "✕ Cancelar" : "+ Adicionar convidado"}
          </button>
        )}
      </div>

      {/* Seletor de jogo */}
      {jogos.length === 0 ? (
        <div className={f.vazio}>Nenhum jogo futuro agendado.</div>
      ) : (
        <>
          <div style={{ marginBottom: "1.25rem" }}>
            <label className={f.label}>Jogo</label>
            <select
              className={f.select}
              style={{ maxWidth: 360 }}
              value={jogoSel}
              onChange={e => { setJogoSel(e.target.value); setFormAberto(false); setEditId(null) }}
            >
              {jogos.map(j => (
                <option key={j.id} value={j.id}>
                  {fmtData(j.data)} · {j.local}
                </option>
              ))}
            </select>
          </div>

          {/* Form adicionar */}
          {formAberto && (
            <div className={f.formCard}>
              <div className={f.formTitulo}>Adicionar convidado avulso</div>
              <form onSubmit={adicionarConvidado} className={f.form}>
                <div className={f.formRow}>
                  <div>
                    <label className={f.label}>Nome</label>
                    <input className={f.input} type="text" value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Nome completo" required maxLength={80} />
                  </div>
                  <div>
                    <label className={f.label}>Posição</label>
                    <select className={f.select} value={fPosicao} onChange={e => setFPosicao(e.target.value)}>
                      <option value="goleiro">Goleiro</option>
                      <option value="linha">Linha</option>
                      <option value="qualquer">Qualquer</option>
                    </select>
                  </div>
                  <div>
                    <label className={f.label}>Rating (1-10)</label>
                    <input className={f.input} type="number" min={1} max={10} value={fRating} onChange={e => setFRating(Number(e.target.value))} />
                  </div>
                </div>
                {erroForm && <div className={f.erro}>{erroForm}</div>}
                <button className={f.btnSalvar} type="submit" disabled={salvando}>
                  {salvando ? "Adicionando..." : "Adicionar (já aprovado)"}
                </button>
              </form>
            </div>
          )}

          {loadingConv ? (
            <div className={f.spinner} />
          ) : (
            <>
              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div className={f.section}>
                  <div className={f.sectionTitulo}>Pendentes ({pendentes.length})</div>
                  <div className={f.extrato}>
                    {pendentes.map(c => (
                      <div key={c.id} className={f.extratoRow}>
                        <div style={{ fontSize: "1.1rem" }}>🎟️</div>
                        <div className={f.extratoInfo}>
                          <div className={f.extratoDesc}>{c.nome_convidado}</div>
                          <div className={f.extratoData}>
                            {c.convidado_por?.nome ? `convidado por ${c.convidado_por.nome}` : "sem convidante"}
                            {c.posicao ? ` · ${posicaoLabel[c.posicao] ?? c.posicao}` : ""}
                            {c.rating_habilidade ? ` · ★ ${c.rating_habilidade}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => aprovar(c.id, true)}
                            style={{ padding: "0.3rem 0.7rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}
                          >
                            Aprovar
                          </button>
                          {recusarConfirmId === c.id ? (
                            <>
                              <button
                                onClick={() => { recusar(c.id); setRecusarConfirmId(null) }}
                                style={{ padding: "0.3rem 0.7rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setRecusarConfirmId(null)}
                                style={{ padding: "0.3rem 0.5rem", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", color: "var(--muted)" }}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setRecusarConfirmId(c.id)}
                              style={{ padding: "0.3rem 0.7rem", background: "var(--surface2)", color: "#dc2626", border: "1px solid #dc2626", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}
                            >
                              Recusar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aprovados */}
              <div className={f.section}>
                <div className={f.sectionTitulo}>Aprovados ({aprovados.length})</div>
                {aprovados.length === 0 ? (
                  <div className={f.vazio}>Nenhum convidado aprovado para este jogo.</div>
                ) : (
                  <div className={f.extrato}>
                    {aprovados.map(c => (
                      <div key={c.id} className={f.extratoRow} style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ fontSize: "1.1rem" }}>✅</div>
                        <div className={f.extratoInfo}>
                          <div className={f.extratoDesc}>{c.nome_convidado}</div>
                          {editId === c.id ? (
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                              <select
                                className={f.select}
                                style={{ width: "auto", fontSize: "0.8rem" }}
                                value={ePosicao}
                                onChange={e => setEPosicao(e.target.value)}
                              >
                                <option value="goleiro">Goleiro</option>
                                <option value="linha">Linha</option>
                                <option value="qualquer">Qualquer</option>
                              </select>
                              <input
                                className={f.input}
                                style={{ width: 60 }}
                                type="number"
                                min={1}
                                max={10}
                                value={eRating}
                                onChange={e => setERating(Number(e.target.value))}
                              />
                              <button
                                onClick={() => salvarEdicao(c.id)}
                                disabled={salvandoEdit}
                                style={{ padding: "0.3rem 0.7rem", background: "#111", color: "#FFD600", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}
                              >
                                {salvandoEdit ? "..." : "Salvar"}
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                style={{ padding: "0.3rem 0.7rem", background: "none", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className={f.extratoData}>
                              {c.convidado_por?.nome ? `por ${c.convidado_por.nome}` : "avulso"}
                              {c.posicao ? ` · ${posicaoLabel[c.posicao] ?? c.posicao}` : ""}
                              {c.rating_habilidade ? ` · ★ ${c.rating_habilidade}` : ""}
                            </div>
                          )}
                        </div>
                        {editId !== c.id && (
                          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
                            <button
                              onClick={() => iniciarEditar(c)}
                              style={{ padding: "0.3rem 0.7rem", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text)", fontSize: "0.8rem" }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => aprovar(c.id, false)}
                              style={{ padding: "0.3rem 0.7rem", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--muted)", fontSize: "0.8rem" }}
                            >
                              Mover p/ pendente
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {pendentes.length === 0 && aprovados.length === 0 && (
                <div className={f.vazio}>Nenhum convidado registrado para {jogoAtual ? `o jogo de ${fmtData(jogoAtual.data)}` : "este jogo"}.</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
