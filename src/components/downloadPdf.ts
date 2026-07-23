/** Capture a DOM node and download it as a multi-page letter PDF. */
export async function downloadElementAsPdf(
  el: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#fffef8',
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 12
  const usableW = pageW - margin * 2
  const usableH = pageH - margin * 2
  const imgH = (canvas.height * usableW) / canvas.width

  let remaining = imgH
  let offsetY = 0

  while (remaining > 0) {
    if (offsetY > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, margin - offsetY, usableW, imgH)
    remaining -= usableH
    offsetY += usableH
  }

  pdf.save(filename)
}
