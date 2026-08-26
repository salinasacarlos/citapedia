export function EstadoVacio({
  titulo,
  children,
}: {
  titulo: string
  children?: React.ReactNode
}) {
  return (
    <div className="tarjeta px-6 py-12 text-center">
      <p className="font-semibold text-ink">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}
