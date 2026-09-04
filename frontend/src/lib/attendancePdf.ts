// Generador de PDF compartido entre la pantalla del Director (Administración
// → Reportes → Asistencia Diaria) y la del Maestro (plantel-docente →
// Asistencia) — mismo diseño en los dos casos, con espacio de firma del
// maestro responsable como respaldo físico de que él mismo la registró.

const STATUS_LABELS: Record<string, string> = {
  PRESENTE: 'Presente', AUSENTE: 'Ausente', RETRASO: 'Retraso', LICENCIA: 'Licencia',
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
  courseLabel: string
  date: string // YYYY-MM-DD
  teacherName: string | null
  students: AttendancePdfStudent[]
}

export async function exportAttendancePdf(input: AttendancePdfInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(`${input.districtName}${input.districtLocation ? ` — ${input.districtLocation}` : ''}`, 14, 15)
  doc.setFontSize(12)
  doc.text('Registro de Asistencia', 14, 25)
  doc.setFontSize(10)
  doc.text(`Curso: ${input.courseLabel}`, 14, 34)
  doc.text(`Fecha: ${new Date(input.date + 'T00:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 14, 40)
  doc.text(`Maestro responsable: ${input.teacherName || '—'}`, 14, 46)

  const sorted = [...input.students].sort((a, b) => a.lastName.localeCompare(b.lastName))

  autoTable(doc, {
    startY: 53,
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
  doc.text('_______________________________', 14, finalY)
  doc.text('Firma del Maestro Responsable', 14, finalY + 6)
  doc.text(input.teacherName || '', 14, finalY + 12)

  const safeCourse = input.courseLabel.replace(/[^\w]+/g, '_')
  doc.save(`asistencia_${safeCourse}_${input.date}.pdf`)
}
