/** Marca: recibo rasgado con un `$`. Un solo color (currentColor) para que escale a 16px. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path
        d="M9 4h22a2 2 0 0 1 2 2v26l-3.5-2.6L26 32l-3.5-2.6L19 32l-3.5-2.6L12 32l-3-2.2V6a2 2 0 0 1 0-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M26 4l7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <text
        x="20.5"
        y="23"
        textAnchor="middle"
        fontFamily="Bricolage Grotesque, system-ui, sans-serif"
        fontWeight="800"
        fontSize="16"
        fill="currentColor"
      >
        $
      </text>
    </svg>
  );
}

/** Wordmark "póster apilado": tres líneas condensadas en mayúsculas; compacto = una línea (móvil). */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-1" role="img" aria-label="How much did u waste?">
      <LogoMark className="h-9 w-9 flex-none text-term-amber" />
      {compact ? (
        <span className="logo-word truncate text-[19px] text-term-text">
          How much did u <span className="text-term-amber">waste?</span>
        </span>
      ) : (
        <span className="logo-word text-[25px] text-term-text">
          <span className="block">How much</span>
          <span className="block">did u</span>
          <span className="block text-term-amber">
            waste<span className="text-term-muted"> ?</span>
          </span>
        </span>
      )}
    </div>
  );
}
