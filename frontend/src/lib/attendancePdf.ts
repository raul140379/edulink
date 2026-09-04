// Generador de PDF compartido entre la pantalla del Director (Administración
// → Reportes → Asistencia Diaria) y la del Maestro (plantel-docente →
// Asistencia) — mismo diseño en los dos casos, con espacio de firma del
// maestro responsable como respaldo físico de que él mismo la registró.

const STATUS_LABELS: Record<string, string> = {
  PRESENTE: 'Presente', AUSENTE: 'Ausente', RETRASO: 'Retraso', LICENCIA: 'Licencia',
}

const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}

export interface AttendancePdfStudent {
  firstName: string
  lastName: string
  gender?: string
  status: string | null
}

export interface AttendancePdfInput {
  districtName: string
  districtLocation?: string | null
  schoolName: string | null
  courseLevel: string // Course.level (INICIAL/PRIMARIA/SECUNDARIA)
  courseLabel: string
  date: string // YYYY-MM-DD
  teacherName: string | null
  students: AttendancePdfStudent[]
}

export async function exportAttendancePdf(input: AttendancePdfInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  const MARGIN = 14
  const usableWidth = doc.internal.pageSize.getWidth() - MARGIN * 2

  // Imprime respetando el margen — un string real (nombre de distrito +
  // ubicación) puede medir más del doble del ancho de la página (confirmado:
  // 249mm en una hoja A4 de 210mm) y doc.text() plano no hace wrap solo, se
  // corta silenciosamente fuera del área imprimible. splitTextToSize corta
  // por palabra al ancho disponible; se devuelve el Y siguiente según
  // cuántas líneas ocupó, para no pisar el contenido de abajo.
  const printWrapped = (text: string, y: number, fontSize: number): number => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, usableWidth) as string[]
    doc.text(lines, MARGIN, y)
    return y + lines.length * fontSize * 0.406
  }

  let y = 15
  y = printWrapped(`${input.districtName}${input.districtLocation ? ` — ${input.districtLocation}` : ''}`, y, 16) + 3

  const nivel = LEVEL_LABELS[input.courseLevel] || input.courseLevel
  const schoolPart = input.schoolName ? ` — ${input.schoolName}` : ''
  y = printWrapped(`Registro de Asistencia${schoolPart} — ${nivel}`, y, 12) + 7

  doc.setFontSize(10)
  doc.text(`Curso: ${input.courseLabel}`, MARGIN, y); y += 6
  doc.text(`Fecha: ${new Date(input.date + 'T00:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, MARGIN, y); y += 6
  doc.text(`Maestro responsable: ${input.teacherName || '—'}`, MARGIN, y); y += 7

  const sorted = [...input.students].sort((a, b) => a.lastName.localeCompare(b.lastName))

  autoTable(doc, {
    startY: y,
    head: [['#', 'Apellidos y Nombres', 'Género', 'Estado']],
    body: sorted.map((s, i) => [
      i + 1,
      `${s.lastName} ${s.firstName}`,
      s.gender === 'MASCULINO' ? 'M' : s.gender === 'FEMENINO' ? 'F' : '—',
      s.status ? STATUS_LABELS[s.status] || s.status : 'Sin registrar',
    ]),
    styles: { fontSize: 9 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 30
  doc.setFontSize(10)
  doc.text('_______________________________', MARGIN, finalY)
  doc.text('Firma del Maestro Responsable', MARGIN, finalY + 6)
  doc.text(input.teacherName || '', MARGIN, finalY + 12)

  const safeCourse = input.courseLabel.replace(/[^\w]+/g, '_')
  doc.save(`asistencia_${safeCourse}_${input.date}.pdf`)
}
