/**
 * pdfGenerator.ts — wrapper cetak PDF via browser print dialog.
 * Tidak membutuhkan library eksternal; gunakan window.print() bawaan browser.
 */

const PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #111827;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-header {
    border-bottom: 2px solid #111827;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  h1 {
    font-size: 18px;
    font-weight: bold;
    margin: 0 0 4px 0;
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0 6px 0;
  }
  p {
    margin: 3px 0;
  }
  .meta {
    color: #4b5563;
    font-size: 11px;
    margin-bottom: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 8px 10px;
    text-align: left;
    font-size: 11.5px;
  }
  th {
    background-color: #f3f4f6 !important;
    font-weight: 600;
    color: #1f2937;
  }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  @media print {
    body { margin: 0; }
    button { display: none !important; }
  }
`

/**
 * Escape karakter HTML khusus untuk mencegah HTML injection/XSS pada dokumen cetak.
 */
export function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
  <title>${escapeHtml(title)}</title>
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
