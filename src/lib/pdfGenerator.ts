/**
 * pdfGenerator.ts — wrapper cetak PDF via browser print dialog.
 * Tidak membutuhkan library eksternal; gunakan window.print() bawaan browser.
 */

const PRINT_STYLES = `
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
  th { background-color: #f0f0f0; font-weight: bold; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin: 16px 0 4px; }
  p { margin: 2px 0; }
  .meta { color: #555; font-size: 11px; margin-bottom: 12px; }
  @media print {
    body { margin: 0; }
    button { display: none; }
  }
`

/**
 * Buka jendela baru berisi HTML yang siap dicetak, lalu panggil window.print().
 */
export function printHTML(html: string, title: string): void {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Pop-up diblokir. Izinkan pop-up untuk mencetak laporan.')
    return
  }

  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${html}
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</` + `script>
</body>
</html>`)
  win.document.close()
}

/**
 * Unduh Blob sebagai file (untuk ekspor CSV/Excel jika dibutuhkan nanti).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
