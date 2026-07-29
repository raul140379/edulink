'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Search, School, GraduationCap, Users2, Layers, Megaphone, Users } from 'lucide-react'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type ComunicadoType = 'COMUNICADO' | 'CONVOCATORIA' | 'AVISO'

const TIPO_LABELS: Record<string, string> = { FISCAL: 'Fiscal', CONVENIO: 'Convenio', PRIVADA: 'Privada' }

interface PublicSchool {
  id:     number
  name:   string
  tipo:   'FISCAL' | 'CONVENIO' | 'PRIVADA'
  area:   'URBANA' | 'RURAL'
  shifts: string[]
  nucleo: { id: number; name: string } | null
}

const SHIFT_ORDER: Record<string, number> = { MORNING: 0, AFTERNOON: 1, NIGHT: 2 }
const shiftRank = (s: PublicSchool) => Math.min(...(s.shifts?.length ? s.shifts.map(t => SHIFT_ORDER[t] ?? 9) : [9]))

interface PublicStats {
  schools:  number
  nucleos:  number
  students: number
  teachers: number
}

interface PublicComunicado {
  id:          number
  title:       string
  body:        string
  type:        ComunicadoType
  publishedAt: string
  author:      { id: number; email: string }
}

const TYPE_LABELS: Record<ComunicadoType, string> = {
  COMUNICADO:   'Comunicado',
  CONVOCATORIA: 'Convocatoria',
  AVISO:        'Aviso',
}

interface PublicDirectorio {
  juntaDistrito:    string | null
  gobiernoDistrito: string | null
  nucleos: {
    id: number
    name: string
    juntaPresidente:    string | null
    gobiernoPresidente: string | null
  }[]
}

export default function Home() {
  const router   = useRouter()
  const district = useDistrictConfig()

  const [schools,     setSchools]     = useState<PublicSchool[]>([])
  const [stats,       setStats]       = useState<PublicStats | null>(null)
  const [comunicados, setComunicados] = useState<PublicComunicado[]>([])
  const [directorio,  setDirectorio]  = useState<PublicDirectorio | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [logoOk,      setLogoOk]      = useState(true)

  const [search, setSearch] = useState('')
  const [level,  setLevel]  = useState('TODOS')
  const [zone,   setZone]   = useState('TODOS')

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/public/schools`).then(r => r.json()),
      fetch(`${API_URL}/api/public/stats`).then(r => r.json()),
      fetch(`${API_URL}/api/public/comunicados`).then(r => r.json()),
      fetch(`${API_URL}/api/public/directorio`).then(r => r.json()),
    ]).then(([s, st, c, d]) => {
      setSchools(Array.isArray(s) ? s : [])
      setStats(st)
      setComunicados(Array.isArray(c) ? c : [])
      setDirectorio(d)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
      if (level !== 'TODOS' && s.tipo !== level) return false
      if (zone  !== 'TODOS' && s.area !== zone)  return false
      return true
    })
  }, [schools, search, level, zone])

  const groupedSchools = useMemo(() => {
    const groups = new Map<string, PublicSchool[]>()
    for (const s of filteredSchools) {
      const key = s.nucleo?.name || 'Sin núcleo'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => shiftRank(a) - shiftRank(b) || a.name.localeCompare(b.name))
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Sin núcleo') return 1
      if (b === 'Sin núcleo') return -1
      return a.localeCompare(b)
    })
  }, [filteredSchools])

  const goLogin = () => router.push('/login')
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="portal">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            {logoOk && district.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={district.logoUrl} alt={`Escudo de ${district.name}`} onError={() => setLogoOk(false)} />
            ) : (
              <div className="brand-fallback"><School size={22}/></div>
            )}
            <div className="brand-text">
              <span className="brand-name">{district.name}</span>
              <span className="brand-sub">Portal de Unidades Educativas</span>
            </div>
          </div>
          <nav className="nav">
            <button onClick={() => scrollTo('inicio')}>Inicio</button>
            <button onClick={() => scrollTo('comunicacion')}>Comunicación</button>
            <button onClick={() => scrollTo('unidades')}>Unidades Educativas</button>
            <button onClick={() => scrollTo('directorio')}>Junta y Gobierno Estudiantil</button>
            <button onClick={() => scrollTo('info')}>Información</button>
          </nav>
          <button className="btn-login" onClick={goLogin}><LogIn size={15}/> Acceder</button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="inicio" className="hero">
        <div className="hero-inner">
          <span className="hero-badge">Gestión Educativa Municipal</span>
          <h1>Un solo sistema para<br/>todas nuestras unidades educativas</h1>
          <p>Directores, Regentes y la Junta Escolar de cada unidad educativa del distrito acceden aquí a su plataforma de gestión. Este portal también informa a la comunidad sobre comunicados, convocatorias y avisos oficiales.</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => scrollTo('unidades')}>Ver unidades educativas</button>
            <button className="btn-outline" onClick={goLogin}><LogIn size={15}/> Acceder al sistema</button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="stats">
        <div className="stats-inner">
          <div className="stat"><Layers size={20}/><span className="stat-n">{stats?.nucleos ?? '—'}</span><span className="stat-l">Núcleos escolares</span></div>
          <div className="stat"><School size={20}/><span className="stat-n">{stats?.schools ?? '—'}</span><span className="stat-l">Unidades educativas</span></div>
          <div className="stat"><GraduationCap size={20}/><span className="stat-n">{stats?.students ?? '—'}</span><span className="stat-l">Estudiantes</span></div>
          <div className="stat"><Users2 size={20}/><span className="stat-n">{stats?.teachers ?? '—'}</span><span className="stat-l">Maestros</span></div>
        </div>
      </section>

      {/* ── Comunicación ── */}
      <section id="comunicacion" className="section">
        <div className="section-inner">
          <div className="section-head">
            <Megaphone size={20}/>
            <div>
              <h2>Comunicación</h2>
              <p>Comunicados, convocatorias y avisos oficiales del distrito</p>
            </div>
          </div>
          {comunicados.length === 0 ? (
            <div className="empty-state">No hay comunicados publicados por el momento</div>
          ) : (
            <div className="com-grid">
              {comunicados.map(c => (
                <div key={c.id} className="com-card">
                  <span className={`tpill tpill-${c.type.toLowerCase()}`}>{TYPE_LABELS[c.type]}</span>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                  <span className="com-date">{new Date(c.publishedAt).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Unidades Educativas ── */}
      <section id="unidades" className="section alt">
        <div className="section-inner">
          <div className="section-head">
            <School size={20}/>
            <div>
              <h2>Unidades Educativas</h2>
              <p>Directores y Regentes acceden desde aquí a la gestión de su unidad educativa</p>
            </div>
          </div>

          <div className="filters-bar">
            <div className="search-box">
              <Search size={15}/>
              <input placeholder="Buscar unidad educativa..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <select value={level} onChange={e => setLevel(e.target.value)}>
              <option value="TODOS">Todos los niveles</option>
              <option value="FISCAL">Fiscal</option>
              <option value="CONVENIO">Convenio</option>
              <option value="PRIVADA">Privada</option>
            </select>
            <select value={zone} onChange={e => setZone(e.target.value)}>
              <option value="TODOS">Toda zona</option>
              <option value="URBANA">Urbana</option>
              <option value="RURAL">Rural</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Cargando unidades educativas...</div>
          ) : filteredSchools.length === 0 ? (
            <div className="empty-state">No se encontraron unidades educativas con ese criterio</div>
          ) : (
            <div className="nucleo-groups">
              {groupedSchools.map(([nucleoName, group]) => (
                <div key={nucleoName} className="nucleo-group">
                  <h3 className="nucleo-heading">Núcleo {nucleoName} <span>({group.length})</span></h3>
                  <div className="schools-grid">
                    {group.map(s => (
                      <div key={s.id} className="school-card">
                        <div className="school-icon"><School size={18}/></div>
                        <div className="school-name">{s.name}</div>
                        <div className="school-meta">
                          <span className="mpill">{TIPO_LABELS[s.tipo] || s.tipo}</span>
                          <span className="mpill">{s.area === 'URBANA' ? 'Urbana' : 'Rural'}</span>
                        </div>
                        <button className="btn-access" onClick={goLogin}>Acceder →</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Junta de Distrito y Gobierno Estudiantil ── */}
      <section id="directorio" className="section alt">
        <div className="section-inner">
          <div className="section-head">
            <Users size={20}/>
            <div>
              <h2>Junta de Padres y Gobierno Estudiantil</h2>
              <p>Directorio de representantes electos a nivel Distrito y Núcleo</p>
            </div>
          </div>

          {!directorio ? (
            <div className="empty-state">Cargando directorio...</div>
          ) : (
            <>
              <div className="directorio-grid">
                <div className="dir-card dir-card-distrito">
                  <span className="dir-label">Junta de Distrito</span>
                  <span className="dir-name">{directorio.juntaDistrito || 'Sin designar'}</span>
                </div>
                <div className="dir-card dir-card-distrito">
                  <span className="dir-label">Gobierno Estudiantil de Distrito</span>
                  <span className="dir-name">{directorio.gobiernoDistrito || 'Sin designar'}</span>
                </div>
              </div>

              {directorio.nucleos.length > 0 && (
                <div className="nucleos-dir-grid">
                  {directorio.nucleos.map(n => (
                    <div key={n.id} className="dir-card">
                      <span className="dir-label">Núcleo {n.name}</span>
                      <div className="dir-row"><span>Junta:</span><strong>{n.juntaPresidente || 'Sin designar'}</strong></div>
                      <div className="dir-row"><span>Gobierno Estudiantil:</span><strong>{n.gobiernoPresidente || 'Sin designar'}</strong></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Información ── */}
      <section id="info" className="section">
        <div className="section-inner">
          <div className="section-head">
            <Layers size={20}/>
            <div>
              <h2>Información</h2>
              <p>{district.name}{district.location ? ` · ${district.location}` : ''}</p>
            </div>
          </div>
          <p className="info-text">
            {district.name} organiza sus unidades educativas en {stats?.nucleos ?? 0} núcleos escolares, urbanos y rurales,
            bajo la administración de un Director Distrital. Cada unidad educativa mantiene su propia dirección, secretaría
            y Junta Escolar, con acceso independiente a este sistema de gestión.
          </p>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span>{district.name}</span>
          <button onClick={goLogin}><LogIn size={14}/> Acceder al sistema</button>
        </div>
      </footer>

      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        .portal { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#173B2E; background:#fff; }

        .header { position:sticky; top:0; z-index:100; background:#fff; border-bottom:1px solid #DCEEE6; }
        .header-inner { max-width:1180px; margin:0 auto; padding:12px 24px; display:flex; align-items:center; gap:24px; }
        .brand { display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
        .brand img { width:44px; height:44px; object-fit:contain; flex-shrink:0; }
        .brand-fallback { width:44px; height:44px; border-radius:50%; background:#0F6E56; color:#F5C518; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .brand-text { display:flex; flex-direction:column; min-width:0; }
        .brand-name { font-size:14px; font-weight:800; color:#0A5A45; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .brand-sub { font-size:11px; color:#6B8F7F; }
        .nav { display:flex; gap:4px; }
        .nav button { background:none; border:none; padding:8px 12px; font-size:13px; font-weight:600; color:#3A5A4C; cursor:pointer; border-radius:8px; white-space:nowrap; }
        .nav button:hover { background:#EAF6F0; color:#0A5A45; }
        .btn-login { display:flex; align-items:center; gap:6px; padding:9px 16px; background:#0F6E56; color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .btn-login:hover { background:#0A5A45; }

        .hero { background:linear-gradient(150deg,#0F6E56 0%,#0A5A45 70%); padding:64px 24px; }
        .hero-inner { max-width:820px; margin:0 auto; text-align:center; display:flex; flex-direction:column; align-items:center; gap:18px; }
        .hero-badge { display:inline-block; background:rgba(245,197,24,.18); border:1px solid rgba(245,197,24,.45); color:#F5C518; font-size:11px; font-weight:700; letter-spacing:1.2px; padding:6px 14px; border-radius:20px; text-transform:uppercase; }
        .hero h1 { font-size:36px; font-weight:800; color:#fff; line-height:1.25; }
        .hero p { font-size:14px; color:rgba(255,255,255,.85); line-height:1.7; max-width:640px; }
        .hero-actions { display:flex; gap:12px; margin-top:8px; flex-wrap:wrap; justify-content:center; }
        .btn-primary { padding:12px 22px; background:#F5C518; color:#0A5A45; border:none; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer; }
        .btn-primary:hover { background:#ffd94d; }
        .btn-outline { display:flex; align-items:center; gap:6px; padding:12px 22px; background:rgba(255,255,255,.08); color:#fff; border:1.5px solid rgba(255,255,255,.5); border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; }
        .btn-outline:hover { background:rgba(255,255,255,.18); }

        .stats { background:#0A5A45; }
        .stats-inner { max-width:1180px; margin:0 auto; padding:28px 24px; display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .stat { display:flex; flex-direction:column; align-items:center; gap:4px; color:#fff; text-align:center; }
        .stat svg { color:#F5C518; margin-bottom:2px; }
        .stat-n { font-size:26px; font-weight:800; }
        .stat-l { font-size:11px; color:rgba(255,255,255,.75); }

        .section { padding:56px 24px; }
        .section.alt { background:#F5FAF7; }
        .section-inner { max-width:1180px; margin:0 auto; }
        .section-head { display:flex; align-items:flex-start; gap:12px; margin-bottom:28px; color:#0A5A45; }
        .section-head h2 { font-size:22px; font-weight:800; margin-bottom:4px; }
        .section-head p { font-size:13px; color:#6B8F7F; }

        .empty-state { padding:40px; text-align:center; color:#6B8F7F; font-size:13px; background:#F5FAF7; border-radius:12px; }

        .com-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
        .com-card { background:#fff; border:1px solid #DCEEE6; border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:8px; }
        .com-card h3 { font-size:15px; font-weight:800; color:#0A5A45; }
        .com-card p { font-size:13px; color:#3A5A4C; line-height:1.6; flex:1; }
        .com-date { font-size:11px; color:#6B8F7F; }
        .tpill { align-self:flex-start; font-size:10px; font-weight:800; padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:.5px; }
        .tpill-comunicado { background:#E0F2EA; color:#0A5A45; }
        .tpill-convocatoria { background:#FBF0D9; color:#8A6116; }
        .tpill-aviso { background:#FFE6E0; color:#C0392B; }

        .filters-bar { display:flex; gap:10px; margin-bottom:22px; flex-wrap:wrap; }
        .search-box { display:flex; align-items:center; gap:8px; background:#fff; border:1.5px solid #DCEEE6; border-radius:9px; padding:9px 14px; flex:1; min-width:220px; color:#6B8F7F; }
        .search-box input { border:none; outline:none; font-size:13px; flex:1; color:#173B2E; }
        .filters-bar select { padding:9px 12px; border:1.5px solid #DCEEE6; border-radius:9px; font-size:13px; color:#173B2E; background:#fff; outline:none; }

        .nucleo-groups { display:flex; flex-direction:column; gap:28px; }
        .nucleo-heading { font-size:13px; font-weight:800; color:#0A5A45; text-transform:uppercase; letter-spacing:.5px; margin-bottom:14px; }
        .nucleo-heading span { font-weight:600; color:#6B8F7F; text-transform:none; letter-spacing:normal; }
        .schools-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
        .school-card { background:#fff; border:1px solid #DCEEE6; border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:8px; }
        .school-icon { width:38px; height:38px; border-radius:10px; background:#E0F2EA; color:#0A5A45; display:flex; align-items:center; justify-content:center; }
        .school-name { font-size:14px; font-weight:800; color:#173B2E; }
        .school-meta { display:flex; gap:6px; flex-wrap:wrap; }
        .mpill { font-size:10px; font-weight:700; background:#F5FAF7; color:#0A5A45; padding:3px 9px; border-radius:20px; }
        .btn-access { margin-top:6px; padding:9px; background:#0F6E56; color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; }
        .btn-access:hover { background:#0A5A45; }

        .directorio-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-bottom:16px; }
        .nucleos-dir-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
        .dir-card { background:#fff; border:1px solid #DCEEE6; border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:6px; }
        .dir-card-distrito { border-color:#0F6E56; background:#F5FAF7; }
        .dir-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:#0A5A45; }
        .dir-name { font-size:15px; font-weight:700; color:#173B2E; }
        .dir-row { display:flex; justify-content:space-between; gap:8px; font-size:12px; color:#3A5A4C; }
        .dir-row strong { color:#173B2E; text-align:right; }

        .info-text { font-size:13px; color:#3A5A4C; line-height:1.8; max-width:760px; }

        .footer { background:#173B2E; padding:20px 24px; }
        .footer-inner { max-width:1180px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .footer-inner span { font-size:12px; color:rgba(255,255,255,.7); }
        .footer-inner button { display:flex; align-items:center; gap:6px; background:none; border:1px solid rgba(255,255,255,.3); color:#fff; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; }
        .footer-inner button:hover { background:rgba(255,255,255,.1); }

        @media(max-width:820px) {
          .nav { display:none; }
          .hero h1 { font-size:28px; }
          .stats-inner { grid-template-columns:repeat(2,1fr); }
        }
      `}</style>
    </div>
  )
}
