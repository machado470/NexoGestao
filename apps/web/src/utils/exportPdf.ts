export function exportPrintable(title: string) {
  const style = document.createElement('style')
  style.innerHTML = `
    @media print {
      body { background: white !important; color: #000 !important; }
      .no-print { display: none !important; }
      .print-container { padding: 24px; }
    }
  `
  document.head.appendChild(style)
  document.title = title
  window.print()
}
