'use client'

import { Construction } from 'lucide-react'
import Card from '@/components/ui/Card'

export default function TesoreriaEnConstruccion() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Tesorería</h1>
        <p className="text-[13px] text-neutral-500">Recaudación y estado de cuentas</p>
      </div>
      <Card className="flex flex-col items-center gap-3 py-16 text-center text-neutral-500">
        <Construction size={40} className="text-neutral-300"/>
        <p className="text-[15px] font-medium text-brand-700">Esta función está en construcción</p>
        <p className="text-[13px] max-w-md">
          La tesorería a nivel de núcleo/distrito todavía no existe — por ahora, cada Junta Escolar
          administra la recaudación de su propio colegio.
        </p>
      </Card>
    </div>
  )
}
