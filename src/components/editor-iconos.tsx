/**
 * Íconos de la barra del editor.
 *
 * Dibujados a mano y no traídos de una librería: son ocho glifos, y una
 * dependencia de iconos pesa más que esto en un servidor que ya mueve datos
 * de salud. `currentColor` deja que el botón decida el color al estar activo.
 */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const Iconos = {
  bold: () => (
    <svg {...base}>
      <path d="M4.5 2.5h4a2.5 2.5 0 0 1 0 5h-4z" />
      <path d="M4.5 7.5h4.75a3 3 0 0 1 0 6H4.5z" />
    </svg>
  ),
  italic: () => (
    <svg {...base}>
      <path d="M10 2.5H6M10 13.5H6M9.5 2.5 6.5 13.5" />
    </svg>
  ),
  strike: () => (
    <svg {...base}>
      <path d="M2.5 8h11" />
      <path d="M11.5 4.6C11 3.3 9.7 2.5 8 2.5c-2 0-3.2 1-3.2 2.4 0 1.2.9 1.9 2.4 2.4" />
      <path d="M4.7 11.2c.4 1.4 1.7 2.3 3.4 2.3 2.1 0 3.4-1 3.4-2.5 0-1-.5-1.7-1.5-2.2" />
    </svg>
  ),
  liga: () => (
    <svg {...base}>
      <path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-1 1" />
      <path d="M9.2 6.8a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l1-1" />
    </svg>
  ),
  vinetas: () => (
    <svg {...base}>
      <path d="M6 4h8M6 8h8M6 12h8" />
      <circle cx="2.8" cy="4" r=".9" fill="currentColor" stroke="none" />
      <circle cx="2.8" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="2.8" cy="12" r=".9" fill="currentColor" stroke="none" />
    </svg>
  ),
  numerada: () => (
    <svg {...base}>
      <path d="M6 4h8M6 8h8M6 12h8" />
      <path d="M2 2.9h.9V5.4M1.6 5.4h1.8" strokeWidth="1.2" />
      <path d="M1.5 7.6c.2-.5 1.6-.7 1.6.3S1.5 9.2 1.5 9.6h1.8" strokeWidth="1.2" />
      <path d="M1.6 11.4h1.5l-.9 1.1c.7 0 1 .3 1 .8s-.4.8-1 .8c-.4 0-.8-.1-1-.4" strokeWidth="1.2" />
    </svg>
  ),
  cita: () => (
    <svg {...base}>
      <path d="M2.5 3.5v9" strokeWidth="2" />
      <path d="M6 5h7.5M6 8h7.5M6 11h5" />
    </svg>
  ),
  limpiar: () => (
    <svg {...base}>
      <path d="M4 13.5h9" />
      <path d="M6.2 11 3.6 8.4a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L8 10.6" />
      <path d="m5.5 5.5 5 5" />
    </svg>
  ),
}
