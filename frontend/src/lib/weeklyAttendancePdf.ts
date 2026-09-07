// PDF de la Matriz Semanal de Asistencia — reporte gerencial sin firma
// (distinto del PDF diario con firma que ya existe, ver attendancePdf.ts).
//
// Historial de este diseño (5/6-sep-2026, 4 vueltas, cada una medida con
// jsPDF/jspdf-autotable reales, no a ojo):
// 1) Abreviación por diccionario en el encabezado — materias que comparten
//    primera palabra quedaban indistinguibles.
// 2) Nombre completo ROTADO (didDrawCell + doc.text angle) — sin tope de
//    alto, dejaba solo 13 filas por hoja: 3 hojas para 37 estudiantes.
// 3) Tope de 11mm a 5.5pt de fila — entraban las 37 filas en 1 hoja, pero a
//    11mm no entra NINGÚN carácter de materia (medido: 0) — el encabezado
//    quedó vacío ("solo P1-2"), lo que traicionaba el requisito original
//    ("encabezado muestra la materia real"). Raul lo notó y correctamente
//    pidió volver atrás en ese punto puntual.
// 4) ESTA versión (Opción B, confirmada por Raul): fila de estudiante a
//    4.5pt (más chica que 5.5pt) para ganar presupuesto vertical, columna
//    de nombre a 36mm (a 4.5pt el nombre más largo real, 32.16mm, ya entra
//    en una sola línea sin ese ancho extra). Con esa fila más angosta, un
//    tope de encabezado de 34mm SÍ entra en una sola hoja para 37 filas
//    (confirmado con `pagesGenerated` real de la librería) — y a 34mm de
//    alto, casi todas las materias entran ROTADAS completas; solo la más
//    larga de la semana ("Valores, Espiritualidad y Religiones", 32.94mm a
//    6pt) se recorta un poco. Esa (y solo esa, si aplica) va a la leyenda
//    del pie — ya no hace falta una leyenda completa de las 17+ materias.
//
// OJO al tocar esto: `getHeadHeight()` de jspdf-autotable da un número
// INFLADO cuando hay una celda con rowSpan (confirmado con un repro
// aislado) — nunca usarlo para calcular presupuesto de alto. La única
// fuente de verdad real es `pagesGenerated` (cuántas páginas usó la tabla
// de verdad), no una cuenta en mm a mano.
import { DAY_NAMES, PivotedMatrix, CellStatus } from './weeklyAttendanceMatrix'

const CELL_LETTER: Record<CellStatus, string> = {
  PRESENTE: 'P', AUSENTE: 'F', RETRASO: 'R', LICENCIA: 'L', SIN_REGISTRAR: '·', SIN_HORARIO: '',
}

// Medidos y verificados contra jsPDF/jspdf-autotable reales con los 37
// estudiantes reales del curso 3° "A" (6-sep-2026) — esta combinación es la
// única probada que da pagesGenerated:1 CON materia visible en el
// encabezado. Cambiar cualquiera de estos valores sin volver a medir con
// `pagesGenerated` real puede volver a partir la tabla en varias páginas.
const ROW_FONT_SIZE = 4.5
const NAME_COL_WIDTH = 36
const PERIOD_COL_WIDTH = 10
// 30, no 34: el título real de esta pantalla mide más que el placeholder
// usado en la primera pasada de medición (startY real 20.65mm, no 16.65mm)
// — verificado directo contra el script de exportación real con
// `pagesGenerated`, no contra una estimación en mm (ver nota de arriba
// sobre por qué nunca confiar en getHeadHeight()). A 30mm, 7 de las 17
// materias con horario esta semana necesitan recortarse (van a la leyenda);
// a 31mm ya vuelve a ser 2 páginas.
const HEADER_ROW_HEIGHT = 30
const SUBJECT_FONT_SIZE = 6
const PERIOD_LABEL_SPACE = 5 // mm reservados arriba para el label "P1-2" antes de que arranque el texto rotado
const SUBJECT_BOTTOM_BUFFER = 3

export interface WeeklyAttendancePdfInput {
  districtName: string
  districtLocation?: string | null
  schoolName: string | null
  courseLevel: string
  courseLabel: string
  weekStart: string
  weekEnd: string
  matrix: PivotedMatrix
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export async function exportWeeklyAttendancePdf(input: WeeklyAttendancePdfInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })
  const MARGIN = 10
  const pageHeight = doc.internal.pageSize.getHeight()
  const usableWidth = doc.internal.pageSize.getWidth() - MARGIN * 2

  const printWrapped = (text: string, y: number, fontSize: number): number => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, usableWidth) as string[]
    doc.text(lines, MARGIN, y)
    return y + lines.length * fontSize * 0.406
  }

  // Título en UNA sola línea compacta (9pt) — cada línea de más le cuesta
  // directo al presupuesto de alto que necesita la tabla para entrar en una
  // sola hoja (medido: con el título de 3 líneas del PDF diario, la tabla
  // nunca entraba en una hoja con 37 estudiantes, sin importar el resto).
  let y = 13
  const rango = `${formatShortDate(input.weekStart)} al ${formatShortDate(input.weekEnd)}/${input.weekEnd.slice(0, 4)}`
  // Mismo criterio que el PDF diario (attendancePdf.ts): el nombre de la UE
  // (school.name real, vía useSchoolConfig()) es el dato que más le importa
  // a quien lee el reporte — va primero y con su propia etiqueta, en vez de
  // quedar mezclado sin distinguir dentro del nombre del distrito.
  const titleLine = `${input.schoolName || input.districtName} — Registro Semanal de Asistencia — Curso: ${input.courseLabel} — Semana: ${rango}`
  y = printWrapped(titleLine, y, 9) + 4

  const { columns, rows } = input.matrix

  // Truncado por ancho REAL disponible (no una cuenta de caracteres a mano)
  // — mide con doc.getTextWidth en el mismo font/size que se va a dibujar.
  const truncateToWidth = (text: string, maxWidthMm: number): string => {
    doc.setFontSize(SUBJECT_FONT_SIZE)
    if (doc.getTextWidth(text) <= maxWidthMm) return text
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      const candidate = `${text.slice(0, mid)}…`
      if (doc.getTextWidth(candidate) <= maxWidthMm) lo = mid
      else hi = mid - 1
    }
    return `${text.slice(0, lo)}…`
  }

  const maxSubjectSpace = HEADER_ROW_HEIGHT - PERIOD_LABEL_SPACE - SUBJECT_BOTTOM_BUFFER
  // Solo se anota en la leyenda lo que REALMENTE se recortó — con 34mm de
  // tope casi todo entra completo, no hace falta traducir lo que ya se lee.
  const truncatedLegend: string[] = []

  // Separador visual entre bloques de día: la última columna de cada día
  // recibe un borde derecho más grueso, aplicado vía columnStyles (cubre
  // encabezado y cuerpo por igual).
  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { halign: 'left', cellWidth: NAME_COL_WIDTH, fontSize: ROW_FONT_SIZE, overflow: 'linebreak' },
  }
  for (let idx = 0; idx < columns.length; idx++) {
    const isLastOfDay = idx === columns.length - 1 || columns[idx + 1].dayOfWeek !== columns[idx].dayOfWeek
    columnStyles[idx + 1] = {
      cellWidth: PERIOD_COL_WIDTH,
      ...(isLastOfDay ? { lineWidth: { top: 0.1, right: 0.7, bottom: 0.1, left: 0.1 } } : {}),
    }
  }

  type HeadCell = string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> }
  const dayHeaderRow: HeadCell[] = [{ content: 'Apellidos y Nombres', rowSpan: 2, styles: { valign: 'middle' } }]
  const periodHeaderRow: HeadCell[] = []

  let i = 0
  while (i < columns.length) {
    const day = columns[i].dayOfWeek
    let span = 0
    let j = i
    while (j < columns.length && columns[j].dayOfWeek === day) { span += 1; j++ }
    dayHeaderRow.push({ content: `${DAY_NAMES[day]}\n${formatShortDate(columns[i].date)}`, colSpan: span })
    for (let k = i; k < j; k++) {
      const c = columns[k]
      const periodLabel = c.periodStart === c.periodEnd ? `P${c.periodStart}` : `P${c.periodStart}-${c.periodEnd}`
      // El contenido de la celda es solo el label de período — el nombre de
      // materia se dibuja aparte, rotado, en el hook didDrawCell de abajo
      // (autoTable no rota texto por sí solo).
      periodHeaderRow.push({
        content: periodLabel,
        styles: {
          minCellHeight: HEADER_ROW_HEIGHT, valign: 'top', fontSize: 6,
          ...(c.hasSchedule ? {} : { textColor: [170, 170, 170], fillColor: [245, 245, 243] }),
        },
      })

      if (c.hasSchedule && c.subjectName) {
        const truncated = truncateToWidth(c.subjectName, maxSubjectSpace)
        if (truncated !== c.subjectName) {
          truncatedLegend.push(`${DAY_NAMES[day]} ${periodLabel} = ${c.subjectName}`)
        }
      }
    }
    i = j
  }

  const body = rows.map((r) => [
    `${r.lastName} ${r.firstName}`,
    ...r.cells.map((cell) => ({
      content: CELL_LETTER[cell.status],
      styles: {
        halign: 'center' as const, fontStyle: 'bold' as const, textColor: cellColor(cell.status),
        fillColor: cell.status === 'SIN_HORARIO' ? ([245, 245, 243] as [number, number, number]) : undefined,
      },
    })),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN },
    head: [dayHeaderRow, periodHeaderRow],
    body,
    styles: { fontSize: ROW_FONT_SIZE, cellPadding: 1, halign: 'center', valign: 'middle', overflow: 'ellipsize' },
    headStyles: { fontSize: 6, fillColor: [230, 236, 235], textColor: [20, 40, 35], halign: 'center', overflow: 'visible' },
    columnStyles,
    didDrawCell: (data) => {
      if (data.section !== 'head' || data.row.index !== 1) return
      const c = columns[data.column.index - 1]
      if (!c || !c.hasSchedule || !c.subjectName) return
      doc.setFontSize(SUBJECT_FONT_SIZE)
      doc.setTextColor(20, 40, 35)
      const label = truncateToWidth(c.subjectName, maxSubjectSpace)
      const x = data.cell.x + data.cell.width / 2 + 1.5
      const yStart = data.cell.y + PERIOD_LABEL_SPACE
      doc.text(label, x, yStart, { angle: -90, align: 'left' })
    },
  })

  // Leyenda: solo para las materias que efectivamente se recortaron (casi
  // siempre 0-1, no las 17+ de antes) — si no hizo falta recortar nada,
  // ni siquiera se dibuja el bloque de leyenda.
  if (truncatedLegend.length > 0) {
    doc.setFontSize(7)
    const legendLineHeight = 3.6
    const legendTitleHeight = 6
    const legendHeightNeeded = legendTitleHeight + truncatedLegend.length * legendLineHeight

    let legendY = (doc as any).lastAutoTable.finalY + 6
    if (legendY + legendHeightNeeded > pageHeight - MARGIN) {
      doc.addPage()
      legendY = MARGIN + 4
    }

    doc.setFontSize(8)
    doc.setFont(undefined as any, 'bold')
    doc.text('Materias recortadas en el encabezado (nombre completo)', MARGIN, legendY)
    doc.setFont(undefined as any, 'normal')
    legendY += 5

    doc.setFontSize(7)
    truncatedLegend.forEach((entry) => {
      doc.text(entry, MARGIN, legendY)
      legendY += legendLineHeight
    })
    legendY += 4
    doc.text('P = Presente   F = Falta   R = Retraso   L = Licencia   · = Sin registrar   (celda vacía = sin período programado)', MARGIN, legendY)
  } else {
    doc.setFontSize(7)
    const legendY = (doc as any).lastAutoTable.finalY + 6
    doc.text('P = Presente   F = Falta   R = Retraso   L = Licencia   · = Sin registrar   (celda vacía = sin período programado)', MARGIN, legendY)
  }

  const safeCourse = input.courseLabel.replace(/[^\w]+/g, '_')
  doc.save(`asistencia_semanal_${safeCourse}_${input.weekStart}.pdf`)
}

function cellColor(status: CellStatus): [number, number, number] {
  switch (status) {
    case 'PRESENTE': return [15, 110, 86]
    case 'AUSENTE': return [192, 57, 43]
    case 'RETRASO': return [185, 134, 10]
    case 'LICENCIA': return [74, 159, 212]
    case 'SIN_REGISTRAR': return [150, 150, 150]
    default: return [255, 255, 255]
  }
}
