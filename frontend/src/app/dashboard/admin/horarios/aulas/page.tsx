'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Save, DoorOpen } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Classroom {
  id:       number
  name:     string
  capacity: number | null
  isActive: boolean
}

export default function AulasPage() {
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Classroom | null>(null)
  const [form,       setForm]       = useState({ name: '', capacity: '' })

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/classrooms`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setClassrooms(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', capacity: '' })
    setShowModal(true)
  }

  const openEdit = (c: Classroom) => {
    setEditing(c)
    setForm({ name: c.name, capacity: c.capacity ? String(c.capacity) : '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast('El nombre es requerido', 'error'); return }
    try {
      const url    = editing ? `${API}/api/classrooms/${editing.id}` : `${API}/api/classrooms`
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim(),
          capacity: form.capacity ? parseInt(form.capacity) : null,
        })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(editing ? 'Aula actualizada' : 'Aula creada correctamente', 'success')
      setShowModal(false)
      load()
    } catch { toast('Error de conexión', 'error') }
  }

  const handleDelete = async (c: Classroom) => {
    if (!await confirm(`¿Desactivar "${c.name}"?`, { danger: true })) return
    try {
      const res = await fetch(`${API}/api/classrooms/${c.id}`, { method: 'DELETE', headers: auth() })
      if (!res.ok) { toast('Error al desactivar', 'error'); return }
      toast('Aula desactivada', 'success')
      load()
    } catch { toast('Error de conexión', 'error') }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push('/dashboard/admin/horarios')} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-brand-700 m-0">Gestión de Aulas</h1>
          <p className="text-[13px] text-neutral-500 m-0">Registra los espacios físicos del colegio</p>
        </div>
        <Button onClick={openCreate}><Plus size={16}/> Nueva Aula</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : classrooms.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-12 text-center text-neutral-500">
          <DoorOpen size={40} className="mb-3 opacity-30 mx-auto"/>
          <p className="m-0">No hay aulas registradas. Crea la primera.</p>
          <Button onClick={openCreate} className="mt-4"><Plus size={14}/> Crear aula</Button>
        </div>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-brand-700 uppercase tracking-wide">Aula</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-brand-700 uppercase tracking-wide">Capacidad</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-brand-700 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold text-brand-700 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((c, i) => (
                  <tr key={c.id} className={i%2===0 ? 'bg-white' : 'bg-neutral-100/40'}>
                    <td className="px-4 py-3 border-t border-neutral-100 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="w-[34px] h-[34px] rounded-lg bg-brand-100 flex items-center justify-center text-lg">🚪</div>
                        <span className="font-semibold text-brand-700 text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-t border-neutral-100 align-middle">
                      <span className="text-neutral-500 text-[13px]">{c.capacity ? `${c.capacity} estudiantes` : '—'}</span>
                    </td>
                    <td className="px-4 py-3 border-t border-neutral-100 align-middle">
                      <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Activa' : 'Inactiva'}</Badge>
                    </td>
                    <td className="px-4 py-3 border-t border-neutral-100 align-middle text-right">
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(c)}><Edit2 size={12}/> Editar</Button>
                        {c.isActive && (
                          <Button variant="danger" size="sm" onClick={() => handleDelete(c)}><Trash2 size={12}/> Desactivar</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Aula' : 'Nueva Aula'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}><Save size={14}/> {editing ? 'Actualizar' : 'Crear'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Input
            label="Nombre" required value={form.name}
            onChange={e => setForm(p => ({...p, name: e.target.value}))}
            placeholder="Ej: Aula 101, Laboratorio, Patio"
          />
          <Input
            label="Capacidad (opcional)" type="number" min={1}
            value={form.capacity}
            onChange={e => setForm(p => ({...p, capacity: e.target.value}))}
            placeholder="Ej: 35"
          />
        </div>
      </Modal>
    </div>
  )
}
