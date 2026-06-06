'use client'

import { Construction } from 'lucide-react'

interface Props {
  titulo?:      string
  descripcion?: string
  color?:       string
}

export default function EnConstruccion({
  titulo      = 'Módulo en construcción',
  descripcion = 'Esta funcionalidad estará disponible próximamente.',
  color       = '#1A3A7C',
}: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 20px', textAlign: 'center', gap: '16px'
    }}>
      <div style={{
        width: '80px', height: '80px', background: '#FFFBEA',
        border: '2px solid #F5C518', borderRadius: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Construction size={40} color="#F5C518"/>
      </div>
      <h2 style={{ fontSize: '20px', fontWeight: '700', color, margin: 0 }}>{titulo}</h2>
      <p style={{ fontSize: '14px', color: '#6B8BB0', maxWidth: '400px', lineHeight: '1.6', margin: 0 }}>
        {descripcion}
      </p>
      <div style={{
        background: '#FFFBEA', border: '1px solid #F5C518', borderRadius: '8px',
        padding: '10px 20px', fontSize: '12px', color: '#BA7517', fontWeight: '500'
      }}>
        🚧 Próximamente disponible
      </div>
    </div>
  )
}