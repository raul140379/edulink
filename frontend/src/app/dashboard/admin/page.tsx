'use client'

import { useEffect, useState } from 'react'
import { Users, GraduationCap, BookOpen, DollarSign, Bell, TrendingUp, AlertCircle } from 'lucide-react'

interface StatCard {
  label:    string
  value:    string | number
  icon:     React.ReactNode
  color:    string
  sub?:     string
}

export default function AdminHome() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) setUser(JSON.parse(userData))
  }, [])

  const stats: StatCard[] = [
    { label: 'Estudiantes', value: '0', icon: <GraduationCap size={22}/>, color: '#1A3A7C', sub: 'registrados' },
    { label: 'Padres / Tutores', value: '0', icon: <Users size={22}/>, color: '#4A9FD4', sub: 'registrados' },
    { label: 'Cursos activos', value: '0', icon: <BookOpen size={22}/>, color: '#0F6E56', sub: 'esta gestión' },
    { label: 'Cobros pendientes', value: 'Bs. 0', icon: <DollarSign size={22}/>, color: '#BA7517', sub: 'por cobrar' },
  ]

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div>
      {/* Saludo */}
      <div className="welcome-card">
        <div>
          <h1>{greeting()}, {user?.email?.split('@')[0]} 👋</h1>
          <p>Bienvenido al Sistema de Gestión de la U.E. Naciones Unidas — El Torno, Santa Cruz</p>
        </div>
        <div className="welcome-badge">
          Gestión 2026
        </div>
      </div>

      {/* Estadísticas */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15', color: s.color }}>
              {s.icon}
            </div>
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
              {s.sub && <span className="stat-sub">{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Alertas y accesos rápidos */}
      <div className="bottom-grid">
        <div className="panel">
          <div className="panel-header">
            <Bell size={16}/>
            <span>Notificaciones recientes</span>
          </div>
          <div className="empty-state">
            <AlertCircle size={32} color="#CBE0F0"/>
            <p>No hay notificaciones</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <TrendingUp size={16}/>
            <span>Accesos rápidos</span>
          </div>
          <div className="quick-links">
            <a href="/dashboard/admin/estudiantes" className="quick-link">
              <GraduationCap size={16}/>
              Registrar estudiante
            </a>
            <a href="/dashboard/admin/padres" className="quick-link">
              <Users size={16}/>
              Registrar padre
            </a>
            <a href="/dashboard/admin/cursos" className="quick-link">
              <BookOpen size={16}/>
              Ver cursos
            </a>
            <a href="/dashboard/admin/tesoreria" className="quick-link">
              <DollarSign size={16}/>
              Registrar cobro
            </a>
          </div>
        </div>
      </div>

      <style>{`
        h1 { font-size: 20px; font-weight: 700; color: #1A3A7C; margin-bottom: 6px; }

        .welcome-card {
          background: #1A3A7C;
          border-radius: 14px;
          padding: 24px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 16px;
        }

        .welcome-card h1 { color: #fff; font-size: 20px; margin-bottom: 6px; }
        .welcome-card p  { color: #7BBFE8; font-size: 13px; }

        .welcome-badge {
          background: #F5C518;
          color: #3A2F00;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 20px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #CBE0F0;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-info { display: flex; flex-direction: column; gap: 2px; }
        .stat-value { font-size: 22px; font-weight: 700; color: #1A3A7C; }
        .stat-label { font-size: 13px; font-weight: 500; color: #1A3A7C; }
        .stat-sub   { font-size: 11px; color: #6B8BB0; }

        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .panel {
          background: #fff;
          border: 1px solid #CBE0F0;
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 18px;
          border-bottom: 1px solid #CBE0F0;
          font-size: 13px;
          font-weight: 600;
          color: #1A3A7C;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          gap: 10px;
        }

        .empty-state p { font-size: 13px; color: #6B8BB0; }

        .quick-links {
          display: flex;
          flex-direction: column;
          padding: 8px;
          gap: 4px;
        }

        .quick-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: #1A3A7C;
          text-decoration: none;
          transition: background 0.15s;
        }

        .quick-link:hover { background: #F0F6FC; }

        @media (max-width: 600px) {
          .bottom-grid { grid-template-columns: 1fr; }
          .welcome-badge { display: none; }
        }
      `}</style>
    </div>
  )
}