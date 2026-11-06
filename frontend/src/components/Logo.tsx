export default function Logo({ size = 120 }: { size?: number }) {
  const h = size * (420 / 680)
  return (
    <svg width={size} height={h} viewBox="0 0 680 420" role="img" aria-label="PatotaOfc">
      <defs>
        <clipPath id="sc">
          <path d="M340 38 L428 72 L428 168 Q428 248 340 292 Q252 248 252 168 L252 72 Z" />
        </clipPath>
      </defs>

      <path d="M340 38 L428 72 L428 168 Q428 248 340 292 Q252 248 252 168 L252 72 Z" fill="#1a1a1a" />
      <polygon points="252,145 340,80 428,145 428,195 340,258 252,195" fill="#F5C800" clipPath="url(#sc)" />
      <circle cx="340" cy="162" r="46" fill="#ffffff" clipPath="url(#sc)" />
      <circle cx="340" cy="162" r="46" fill="none" stroke="#dddddd" strokeWidth="1" clipPath="url(#sc)" />
      <path d="M340 38 L428 72 L428 168 Q428 248 340 292 Q252 248 252 168 L252 72 Z" fill="none" stroke="#F5C800" strokeWidth="3.5" />
      <circle cx="340" cy="38" r="5" fill="#F5C800" />

      <text x="340" y="334" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="32" letterSpacing="1">
        <tspan fill="#1a1a1a">PATOTA</tspan><tspan fill="#F5C800">OFC</tspan>
      </text>
      <line x1="252" y1="344" x2="428" y2="344" stroke="#F5C800" strokeWidth="2.5" />
      <text x="340" y="372" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="11" letterSpacing="4" fill="#888888">
        GESTÃO DO SEU FUTEBOL
      </text>
    </svg>
  )
}
