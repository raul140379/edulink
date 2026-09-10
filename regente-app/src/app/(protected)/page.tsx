'use client'

import { useEffect, useRef, useState } from 'react'
import { QrCode, Search, ChevronLeft, CheckCircle2, Bell, FileText, RotateCcw } from 'lucide-react'
import Button from '@/components/Button'
import { ApiError } from '@/lib/api'
import { tardanzasApi, Course, StudentLookup, RosterStudent } from '@/modules/tardanzas/api'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const courseLabel = (c: Course) => `${GRADES[c.grade] || c.grade} "${c.parallel}"`

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Step = 'start' | 'confirm' | 'done'

export default function HomePage() {
  const [step, setStep] = useState<Step>('start')
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<any>(null)

  const [courses, setCourses] = useState<Course[]>([])
  const [manualCourseId, setManualCourseId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)

  const [student, setStudent] = useState<StudentLookup | null>(null)
  const [arrivalTime, setArrivalTime] = useState(nowHHMM())
  const [enteredClass, setEnteredClass] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [lateArrivalId, setLateArrivalId] = useState<number | null>(null)
  const [minutesLate, setMinutesLate] = useState<number | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)
  const [banner, setBanner] = useState('')

  const [showLicense, setShowLicense] = useState(false)
  const [licenseStart, setLicenseStart] = useState('')
  const [licenseEnd, setLicenseEnd] = useState('')
  const [licenseReason, setLicenseReason] = useState('')
  const [licenseSaving, setLicenseSaving] = useState(false)
  const [licenseDone, setLicenseDone] = useState(false)

  useEffect(() => {
    tardanzasApi.getCourses().then(setCourses).catch(() => {})
  }, [])

  useEffect(() => {
    return () => { stopScanner() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startScanner = async () => {
    setScanning(true)
    setError('')
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            const rude = decodedText.trim()
            stopScanner()
            lookupByRude(rude)
          },
          () => {},
        )
      } catch {
        setError('No se pudo acceder a la cámara')
        setScanning(false)
      }
    }, 300)
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2 || state === 3) await scannerRef.current.stop()
      } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  const lookupByRude = async (rude: string) => {
    setError('')
    try {
      const s = await tardanzasApi.getStudentByRude(rude)
      goToConfirm(s)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión')
    }
  }

  const loadRoster = async (courseId: number) => {
    setManualCourseId(courseId)
    setLoadingRoster(true)
    try {
      const rows = await tardanzasApi.getStudentsByCourse(courseId)
      setRoster(rows.filter((r) => r.student.isActive))
    } catch {
      setError('Error al cargar el curso')
    } finally {
      setLoadingRoster(false)
    }
  }

  const pickManualStudent = (r: RosterStudent) => {
    const course = courses.find((c) => c.id === manualCourseId)
    if (!course) return
    goToConfirm({ id: r.student.id, firstName: r.student.firstName, lastName: r.student.lastName, rude: r.student.rude, course })
  }

  const goToConfirm = (s: StudentLookup) => {
    setStudent(s)
    setArrivalTime(nowHHMM())
    setEnteredClass(true)
    setError('')
    setStep('confirm')
  }

  const handleRegister = async () => {
    if (!student) return
    setSaving(true)
    setError('')
    try {
      const result = await tardanzasApi.register(student.id, student.course.id, arrivalTime, enteredClass)
      setLateArrivalId(result.lateArrival.id)
      setMinutesLate(result.lateArrival.minutesLate)
      setBanner(result.message)
      setStep('done')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleNotify = async () => {
    if (!lateArrivalId) return
    setNotifying(true)
    try {
      await tardanzasApi.notify(lateArrivalId)
      setNotified(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión')
    } finally {
      setNotifying(false)
    }
  }

  const openLicense = () => {
    const today = new Date().toISOString().slice(0, 10)
    setLicenseStart(today)
    setLicenseEnd(today)
    setLicenseReason('')
    setLicenseDone(false)
    setShowLicense(true)
  }

  const handleLicense = async () => {
    if (!student) return
    setLicenseSaving(true)
    setError('')
    try {
      await tardanzasApi.registerLicense(student.id, licenseStart, licenseEnd, licenseReason || undefined)
      setLicenseDone(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión')
    } finally {
      setLicenseSaving(false)
    }
  }

  const reset = () => {
    stopScanner()
    setStep('start')
    setMode('scan')
    setManualCourseId(null)
    setRoster([])
    setStudent(null)
    setLateArrivalId(null)
    setMinutesLate(null)
    setNotified(false)
    setBanner('')
    setError('')
    setShowLicense(false)
    setLicenseDone(false)
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-4 max-w-lg mx-auto pb-10">
      {step === 'start' && (
        <>
          <div>
            <h1 className="text-lg font-bold text-brand-700">Registrar llegada tardía</h1>
            <p className="text-[13px] text-text-secondary">Escaneá el QR del estudiante o buscalo manualmente</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setMode('scan'); setError('') }}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold ${mode === 'scan' ? 'bg-brand-700 text-white' : 'bg-white border border-border text-brand-700'}`}
            >
              Escanear QR
            </button>
            <button
              onClick={() => { setMode('manual'); stopScanner(); setError('') }}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold ${mode === 'manual' ? 'bg-brand-700 text-white' : 'bg-white border border-border text-brand-700'}`}
            >
              Buscar manual
            </button>
          </div>

          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>}

          {mode === 'scan' && (
            <div className="bg-white rounded-2xl border border-border p-4 flex flex-col items-center gap-3">
              {scanning ? (
                <>
                  <div id="qr-reader" className="w-full max-w-[300px]" />
                  <Button variant="secondary" onClick={stopScanner} className="w-full justify-center">Cancelar</Button>
                </>
              ) : (
                <Button onClick={startScanner} className="w-full justify-center">
                  <QrCode size={18} /> Abrir cámara
                </Button>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div className="flex flex-col gap-3">
              <select
                value={manualCourseId ?? ''}
                onChange={(e) => loadRoster(Number(e.target.value))}
                className="h-12 px-3.5 rounded-xl border border-border bg-white text-[15px] outline-none"
              >
                <option value="" disabled>Elegí un curso</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
              </select>

              {loadingRoster ? (
                <p className="text-[13px] text-text-secondary text-center py-6">Cargando...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {roster.map((r) => (
                    <button
                      key={r.student.id}
                      onClick={() => pickManualStudent(r)}
                      className="flex items-center justify-between bg-white rounded-xl border border-border px-4 py-3 text-left active:bg-bg-soft"
                    >
                      <span className="text-[14px] font-medium text-brand-700">{r.student.lastName} {r.student.firstName}</span>
                      <Search size={15} className="text-text-secondary shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {step === 'confirm' && student && (
        <>
          <button onClick={() => setStep('start')} className="flex items-center gap-1 text-[13px] text-text-secondary self-start">
            <ChevronLeft size={16} /> Volver
          </button>

          <div className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
            <div>
              <div className="text-lg font-bold text-brand-700">{student.lastName} {student.firstName}</div>
              <div className="text-[13px] text-text-secondary">{courseLabel(student.course)}</div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brand-700">Hora de llegada</label>
              <input
                type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
                className="h-12 px-3.5 rounded-xl border border-border bg-white text-[15px] outline-none focus:border-brand-600"
              />
            </div>

            <label className="flex items-center gap-2.5 text-[14px] font-medium text-brand-700">
              <input type="checkbox" checked={enteredClass} onChange={(e) => setEnteredClass(e.target.checked)} className="w-5 h-5" />
              Entró a clases
            </label>

            {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>}

            <Button onClick={handleRegister} loading={saving}>Registrar llegada tardía</Button>
          </div>
        </>
      )}

      {step === 'done' && student && (
        <>
          <div className="bg-success-100 border border-success-500 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle2 size={22} className="text-success-700 shrink-0" />
            <div>
              <div className="text-[15px] font-bold text-success-700">Registrado</div>
              <div className="text-[13px] text-success-700/80">{banner}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3">
            <div>
              <div className="text-base font-bold text-brand-700">{student.lastName} {student.firstName}</div>
              <div className="text-[13px] text-text-secondary">{courseLabel(student.course)} · {minutesLate} min de atraso</div>
            </div>

            {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>}

            {notified ? (
              <p className="text-[13px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 size={15} /> Padre notificado
              </p>
            ) : (
              <Button variant="secondary" onClick={handleNotify} loading={notifying}>
                <Bell size={16} /> Notificar al padre
              </Button>
            )}

            {!showLicense ? (
              <Button variant="secondary" onClick={openLicense}>
                <FileText size={16} /> Registrar Licencia
              </Button>
            ) : (
              <div className="flex flex-col gap-2.5 border-t border-border pt-3">
                {licenseDone ? (
                  <p className="text-[13px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <CheckCircle2 size={15} /> Licencia registrada
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[12px] font-semibold text-brand-700">Desde</label>
                        <input type="date" value={licenseStart} onChange={(e) => setLicenseStart(e.target.value)}
                          className="h-11 px-2.5 rounded-lg border border-border bg-white text-[13px] outline-none" />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[12px] font-semibold text-brand-700">Hasta</label>
                        <input type="date" value={licenseEnd} onChange={(e) => setLicenseEnd(e.target.value)}
                          className="h-11 px-2.5 rounded-lg border border-border bg-white text-[13px] outline-none" />
                      </div>
                    </div>
                    <input
                      value={licenseReason} onChange={(e) => setLicenseReason(e.target.value)}
                      placeholder="Motivo (opcional)"
                      className="h-11 px-3 rounded-lg border border-border bg-white text-[13px] outline-none"
                    />
                    <Button onClick={handleLicense} loading={licenseSaving}>Guardar Licencia</Button>
                  </>
                )}
              </div>
            )}

            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={16} /> Registrar otro estudiante
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
