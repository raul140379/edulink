'use client'

import { Clock } from 'lucide-react'

export default function HorarioPage() {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'60vh', gap:16, color:'#6B8BB0',
    }}>
      <div style={{
        width:80, height:80, borderRadius:'50%',
        backgroundColor:'#EEF7FD',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <Clock size={36} color="#4A9FD4"/>
      </div>
      <div style={{ fontSize:20, fontWeight:700, color:'#1A3A7C' }}>Horario</div>
      <div style={{ fontSize:14, textAlign:'center', maxWidth:300, lineHeight:1.6 }}>
        Esta sección estará disponible próximamente.<br/>
        El módulo de horarios está en desarrollo.
      </div>
      <div style={{
        backgroundColor:'#EEF7FD', border:'1px solid #CBE0F0',
        borderRadius:8, padding:'8px 18px', fontSize:12,
        color:'#4A9FD4', fontWeight:600,
      }}>
        🚧 Próximamente
      </div>
    </div>
  )
}