import s from "./admin.module.css"

export function SorteioPage() {
  return (
    <div className={s.page}>
      <div className={s.pageHeader}><h1 className={s.pageTitulo}>Sorteio de times</h1></div>
      <div className={s.card}><div className={s.empty}>Em breve: sorteio automático balanceado por nível. 🎲</div></div>
    </div>
  )
}

export function ConvidadosPage() {
  return (
    <div className={s.page}>
      <div className={s.pageHeader}><h1 className={s.pageTitulo}>Convidados</h1></div>
      <div className={s.card}><div className={s.empty}>Em breve: gerenciar convidados por jogo. 🎟️</div></div>
    </div>
  )
}

export function ChurrascosPage() {
  return (
    <div className={s.page}>
      <div className={s.pageHeader}><h1 className={s.pageTitulo}>Churrascos</h1></div>
      <div className={s.card}><div className={s.empty}>Em breve: gerenciar despesas e rateio. 🥩</div></div>
    </div>
  )
}

export function FinanceiroPage() {
  return (
    <div className={s.page}>
      <div className={s.pageHeader}><h1 className={s.pageTitulo}>Financeiro</h1></div>
      <div className={s.card}><div className={s.empty}>Em breve: lançamentos e extrato completo. 📋</div></div>
    </div>
  )
}

export function ConfigPage() {
  return (
    <div className={s.page}>
      <div className={s.pageHeader}><h1 className={s.pageTitulo}>Config. patota</h1></div>
      <div className={s.card}><div className={s.empty}>Em breve: configurações gerais da patota. ⚙️</div></div>
    </div>
  )
}
