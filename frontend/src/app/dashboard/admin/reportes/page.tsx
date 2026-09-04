'use client'

import Link from 'next/link'
import { ClipboardCheck, ChevronRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

// Hub de reportes — hoy solo tiene uno real (Asistencia Diaria); los que
// faltan (calificaciones, matrícula/inscripciones) quedan pendientes por
// separado, sin bloquear a este. Cada reporte nuevo se agrega como otra
// tarjeta acá, no reemplaza esta pantalla.
const REPORTS = [
  {
    href: '/dashboard/admin/reportes/asistencia-diaria',
    icon: ClipboardCheck,
    title: 'Asistencia Diaria por Curso',
    description: 'Qué cursos registraron asistencia en un día específico, y el detalle por estudiante',
  },
]

export default function ReportesPage() {
  return (
    <div>
      <PageHeader title="Reportes" description="Informes agregados del colegio" />
      <div className="flex flex-col gap-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="flex items-center justify-between hover:border-brand-600 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700">
                  <r.icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-brand-700">{r.title}</div>
                  <div className="text-[13px] text-neutral-500">{r.description}</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-neutral-500" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
