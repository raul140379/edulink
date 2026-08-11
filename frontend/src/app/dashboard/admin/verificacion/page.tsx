'use client'

import { useState } from 'react'
import { Search, CheckCircle, XCircle, User, Phone, BookOpen, Bell, Clock, ShieldCheck, ShieldX } from 'lucide-react'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  isActive:  boolean
  parents: {
    relationType: string
    isTutor: boolean
    parent: { firstName: string; lastName: string; ci?: string; phone?: string }
  }[]
  assignments: {
    year:          number
    educationType: string
    course: { level: string; grade: string; parallel: string; shift: string }
    academicYear:  { isActive: boolean }
  }[]
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const REL_LABELS:  Record<string, string> = { PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor Legal', OTRO: 'Otro' }

const getDayName = () => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[new Date().getDay()]
}

const getShiftOfDay = () => {
  const hour = new Date().getHours()
  if (hour >= 6  && hour < 13) return 'MORNING'
  if (hour >= 13 && hour < 19) return 'AFTERNOON'
  return 'NIGHT'
}

export default function VerificacionPage() {
  const district = useDistrictConfig()
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Student[]>([])
  const [selected, setSelected] = useState<Student | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [status,   setStatus]   = useState<'authorized' | 'denied' | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const today        = getDayName()
  const currentShift = getShiftOfDay()
  const now          = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true); setSearched(true); setSelected(null); setStatus(null)
    try {
      const res  = await fetch(`${API_URL}/api/students?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setResults(data)
        if (data.length === 1) setSelected(data[0])
      }
    } catch { setResults([]) }
    finally  { setLoading(false) }
  }

  const handleSelect    = (s: Student) => { setSelected(s); setStatus(null) }
  const handleAuthorize = () => setStatus('authorized')
  const handleDeny      = () => setStatus('denied')

  const handleReset = () => {
    setQuery(''); setResults([]); setSelected(null)
    setSearched(false); setStatus(null)
  }

  const activeCourse = selected?.assignments.find(a => a.academicYear.isActive)
  const isInShift    = activeCourse?.course.shift === currentShift

  return (
    <div className="container">
      <div className="header">
        <div className="header-left">
          <ShieldCheck size={28} color="#0A5A45"/>
          <div>
            <h1>Control de Ingreso</h1>
            <p>U.E. Naciones Unidas{district.location ? ` — ${district.location}` : ''}</p>
          </div>
        </div>
        <div className="time-info">
          <div className="day-badge">{today}</div>
          <div className="time-badge"><Clock size={13}/> {now}</div>
          <div className="shift-badge">Turno {SHIFT_LABELS[currentShift]}</div>
        </div>
      </div>

      <div className="search-card">
        <p className="search-label">Buscar por nombre, CI o RUDE del estudiante o padre/tutor</p>
        <div className="search-row">
          <div className="search-wrap">
            <Search size={18} className="sicon"/>
            <input placeholder="Ej: García, 12345678, 00123456789..."
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} autoFocus/>
          </div>
          <button className="btn-search" onClick={handleSearch} disabled={loading}>
            {loading ? <span className="spinsm"/> : <Search size={16}/>}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          {searched && <button className="btn-reset" onClick={handleReset}>Nueva búsqueda</button>}
        </div>
      </div>

      {results.length > 1 && !selected && (
        <div className="results-card">
          <p className="results-title">Se encontraron {results.length} coincidencias — selecciona un estudiante:</p>
          <div className="results-list">
            {results.map(s => (
              <button key={s.id} className="result-item" onClick={() => handleSelect(s)}>
                <div className="result-avatar">{s.firstName[0]}{s.lastName[0]}</div>
                <div>
                  <div className="result-name">{s.lastName} {s.firstName}</div>
                  <div className="result-meta">
                    {s.ci && <span>CI: {s.ci}</span>}
                    {s.rude && <span>RUDE: {s.rude}</span>}
                  </div>
                </div>
                <span className={`sbadge ${s.isActive ? 'act' : 'ina'}`}>{s.isActive ? 'Activo' : 'Inactivo'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div className="no-results">
          <XCircle size={40} color="#DCEEE6"/>
          <p>No se encontraron estudiantes con ese criterio</p>
        </div>
      )}

      {selected && (
        <div className="detail-card">
          {status === 'authorized' && (
            <div className="status-banner green">
              <CheckCircle size={28}/>
              <div><div className="status-title">INGRESO AUTORIZADO</div>
                <div className="status-sub">{selected.firstName} {selected.lastName} — {now}</div></div>
            </div>
          )}
          {status === 'denied' && (
            <div className="status-banner red">
              <XCircle size={28}/>
              <div><div className="status-title">INGRESO DENEGADO</div>
                <div className="status-sub">{selected.firstName} {selected.lastName} — {now}</div></div>
            </div>
          )}

          <div className="student-info">
            <div className="student-avatar-lg">{selected.firstName[0]}{selected.lastName[0]}</div>
            <div className="student-data">
              <h2>{selected.lastName} {selected.firstName}</h2>
              <div className="student-badges">
                <span className={`sbadge ${selected.isActive ? 'act' : 'ina'}`}>{selected.isActive ? 'Activo' : 'Inactivo'}</span>
                {!selected.isActive && <span className="warn-badge">⚠️ Estudiante inactivo — verificar</span>}
              </div>
              <div className="student-ids">
                {selected.ci   && <span>CI: <strong>{selected.ci}</strong></span>}
                {selected.rude && <span>RUDE: <strong>{selected.rude}</strong></span>}
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-section">
              <div className="section-title"><BookOpen size={14}/> Curso actual</div>
              {activeCourse ? (
                <div className="course-info">
                  <div className="course-big">{GRADE_LABELS[activeCourse.course.grade]} {activeCourse.course.parallel}</div>
                  <div className="course-tags">
                    <span className="tag">{LEVEL_LABELS[activeCourse.course.level]}</span>
                    <span className={`tag ${isInShift ? 'tag-green' : 'tag-gray'}`}>
                      Turno {SHIFT_LABELS[activeCourse.course.shift]}{isInShift ? ' ✓' : ' — No es su turno hoy'}
                    </span>
                    <span className="tag">{activeCourse.educationType}</span>
                  </div>
                  {!isInShift && (
                    <div className="shift-warn">
                      ⚠️ El estudiante pertenece al turno {SHIFT_LABELS[activeCourse.course.shift]}, pero ahora es turno {SHIFT_LABELS[currentShift]}.
                    </div>
                  )}
                </div>
              ) : <div className="no-data">No inscrito en la gestión actual</div>}
            </div>

            <div className="detail-section">
              <div className="section-title"><User size={14}/> Padres y Tutores</div>
              {selected.parents.length === 0 ? (
                <div className="no-data">Sin tutores registrados</div>
              ) : (
                <div className="parents-list">
                  {selected.parents.map((ps, i) => (
                    <div key={i} className={`parent-item ${ps.isTutor ? 'tutor' : ''}`}>
                      <div className="parent-rel">
                        <span className="rel-tag" style={{ color: ps.isTutor ? '#712B13' : '#0A5A45' }}>
                          {ps.isTutor ? '🔑 ' : ''}{REL_LABELS[ps.relationType]}
                        </span>
                      </div>
                      <div className="parent-name">{ps.parent.lastName} {ps.parent.firstName}</div>
                      <div className="parent-contacts">
                        {ps.parent.ci    && <span>CI: {ps.parent.ci}</span>}
                        {ps.parent.phone && <span><Phone size={11}/> {ps.parent.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="detail-section detail-full">
              <div className="section-title"><Bell size={14}/> Notificaciones</div>
              <div className="no-data">Sin notificaciones activas</div>
            </div>
          </div>

          {!status && selected.isActive && (
            <div className="action-row">
              <button className="btn-deny" onClick={handleDeny}><ShieldX size={18}/> Denegar ingreso</button>
              <button className="btn-authorize" onClick={handleAuthorize}><ShieldCheck size={18}/> Autorizar ingreso</button>
            </div>
          )}

          {status && (
            <div className="action-row">
              <button className="btn-reset-full" onClick={handleReset}><Search size={16}/> Nueva verificación</button>
            </div>
          )}

          {!selected.isActive && (
            <div className="inactive-warn">
              ⚠️ Este estudiante está marcado como inactivo. Consultar con la administración antes de autorizar el ingreso.
            </div>
          )}
        </div>
      )}

      <style>{`
        .container{max-width:800px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
        .header{display:flex;align-items:center;justify-content:space-between;background:#0A5A45;color:#fff;border-radius:14px;padding:18px 24px;flex-wrap:wrap;gap:12px}
        .header-left{display:flex;align-items:center;gap:12px}
        .header-left h1{font-size:18px;font-weight:800;margin-bottom:2px}
        .header-left p{font-size:12px;opacity:.75}
        .time-info{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .day-badge{background:rgba(255,255,255,.2);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
        .time-badge{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.15);padding:4px 12px;border-radius:20px;font-size:12px}
        .shift-badge{background:#F5C518;color:#3A2F00;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700}
        .search-card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px}
        .search-label{font-size:13px;color:#6B8F7F;margin:0}
        .search-row{display:flex;gap:10px;flex-wrap:wrap}
        .search-wrap{position:relative;flex:1;min-width:200px}
        .sicon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{width:100%;padding:12px 14px 12px 42px;border:2px solid #DCEEE6;border-radius:10px;font-size:14px;outline:none;color:#0A5A45}
        .search-wrap input:focus{border-color:#0A5A45;box-shadow:0 0 0 3px rgba(10,90,69,.1)}
        .btn-search{display:flex;align-items:center;gap:6px;padding:12px 20px;background:#0A5A45;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
        .btn-search:hover:not(:disabled){background:#4A9FD4}
        .btn-search:disabled{opacity:.6;cursor:not-allowed}
        .btn-reset{padding:12px 16px;background:#F5FAF7;color:#0A5A45;border:1.5px solid #DCEEE6;border-radius:10px;font-size:13px;cursor:pointer}
        .btn-reset:hover{background:#E0ECF8}
        .results-card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}
        .results-title{font-size:13px;color:#6B8F7F;margin:0}
        .results-list{display:flex;flex-direction:column;gap:6px}
        .result-item{display:flex;align-items:center;gap:12px;padding:12px;border:1.5px solid #DCEEE6;border-radius:10px;background:#F8FBFF;cursor:pointer;text-align:left}
        .result-item:hover{border-color:#0A5A45;background:#EAF6F0}
        .result-avatar{width:40px;height:40px;border-radius:50%;background:#0A5A45;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0}
        .result-name{font-size:14px;font-weight:600;color:#0A5A45}
        .result-meta{display:flex;gap:10px;font-size:12px;color:#6B8F7F;margin-top:2px}
        .no-results{display:flex;flex-direction:column;align-items:center;padding:40px;gap:12px;color:#6B8F7F;font-size:13px}
        .detail-card{background:#fff;border:2px solid #DCEEE6;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
        .status-banner{display:flex;align-items:center;gap:14px;padding:16px 20px;font-weight:700}
        .status-banner.green{background:#0F6E56;color:#fff}
        .status-banner.red{background:#C0392B;color:#fff}
        .status-title{font-size:18px;letter-spacing:.5px}
        .status-sub{font-size:12px;opacity:.85;font-weight:400;margin-top:2px}
        .student-info{display:flex;align-items:center;gap:16px;padding:20px;border-bottom:1px solid #F5FAF7}
        .student-avatar-lg{width:64px;height:64px;border-radius:50%;background:#0A5A45;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;flex-shrink:0}
        .student-data h2{font-size:20px;font-weight:800;color:#0A5A45;margin-bottom:6px}
        .student-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
        .warn-badge{background:#FFF0F0;color:#C0392B;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
        .student-ids{display:flex;gap:16px;font-size:12px;color:#6B8F7F}
        .student-ids strong{color:#0A5A45}
        .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #F5FAF7}
        .detail-section{padding:18px 20px;border-right:1px solid #F5FAF7}
        .detail-section:last-child{border-right:none}
        .detail-full{grid-column:1/-1;border-right:none}
        .section-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#0A5A45;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
        .course-info{display:flex;flex-direction:column;gap:8px}
        .course-big{font-size:32px;font-weight:900;color:#0A5A45}
        .course-tags{display:flex;flex-wrap:wrap;gap:6px}
        .tag{background:#F5FAF7;color:#0A5A45;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
        .tag-green{background:#E1F5EE;color:#0F6E56}
        .tag-gray{background:#FFF0F0;color:#C0392B}
        .shift-warn{font-size:11px;color:#C0392B;background:#FFF0F0;border:1px solid #FFBBBB;border-radius:8px;padding:8px;line-height:1.5}
        .parents-list{display:flex;flex-direction:column;gap:8px}
        .parent-item{background:#F8FBFF;border:1px solid #DCEEE6;border-radius:8px;padding:10px 12px}
        .parent-item.tutor{border-color:#F5C518;background:#FFFDF0}
        .parent-rel{margin-bottom:3px}
        .rel-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
        .parent-name{font-size:14px;font-weight:600;color:#0A5A45;margin-bottom:4px}
        .parent-contacts{display:flex;gap:10px;flex-wrap:wrap}
        .parent-contacts span{display:flex;align-items:center;gap:4px;font-size:11px;color:#6B8F7F}
        .no-data{color:#6B8F7F;font-size:13px;font-style:italic}
        .action-row{display:flex;gap:12px;padding:16px 20px;justify-content:flex-end}
        .btn-authorize{display:flex;align-items:center;gap:8px;padding:12px 24px;background:#0F6E56;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}
        .btn-authorize:hover{background:#0A5040}
        .btn-deny{display:flex;align-items:center;gap:8px;padding:12px 24px;background:#C0392B;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}
        .btn-deny:hover{background:#922B21}
        .btn-reset-full{display:flex;align-items:center;gap:8px;padding:12px 24px;background:#0A5A45;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin:0 auto}
        .btn-reset-full:hover{background:#4A9FD4}
        .inactive-warn{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B;padding:14px 20px;font-size:13px;line-height:1.5}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#FFF0F0;color:#C0392B}
        .spinsm{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.detail-grid{grid-template-columns:1fr}.action-row{flex-direction:column}.header{flex-direction:column}}
      `}</style>
    </div>
  )
}