'use client';
import { useEffect, useState } from 'react';
import { BookOpen, Clock, Layers } from 'lucide-react';

interface Assignment {
  subjectName: string;
  campo: string | null;
  courseLabel: string;
  hoursPerWeek: number;
  educationType: string;
}

interface Workload {
  totalHoursPerWeek: number;
  assignments: Assignment[];
}

const CAMPO_COLORS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO: 'bg-green-100 text-green-800',
  COMUNIDAD_SOCIEDAD: 'bg-blue-100 text-blue-800',
  COSMOS_PENSAMIENTO: 'bg-purple-100 text-purple-800',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'bg-orange-100 text-orange-800',
};

const CAMPO_LABEL: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO: 'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD: 'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO: 'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
};

export default function WorkloadPage() {
  const [data, setData] = useState<Workload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/teachers/my-workload`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Cargando carga horaria...</div>;
  if (!data) return <div className="p-8 text-red-500">Error al cargar datos.</div>;

  // Agrupar por materia
  const grouped = data.assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.subjectName]) acc[a.subjectName] = [];
    acc[a.subjectName].push(a);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1A3A7C] mb-6">Mi Carga Horaria</h1>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1A3A7C] text-white rounded-xl p-5 flex items-center gap-4">
          <Clock size={32} />
          <div>
            <p className="text-sm opacity-80">Total horas/semana</p>
            <p className="text-3xl font-bold">{data.totalHoursPerWeek}</p>
          </div>
        </div>
        <div className="bg-[#4A9FD4] text-white rounded-xl p-5 flex items-center gap-4">
          <BookOpen size={32} />
          <div>
            <p className="text-sm opacity-80">Materias asignadas</p>
            <p className="text-3xl font-bold">{Object.keys(grouped).length}</p>
          </div>
        </div>
        <div className="bg-[#0F6E56] text-white rounded-xl p-5 flex items-center gap-4">
          <Layers size={32} />
          <div>
            <p className="text-sm opacity-80">Cursos asignados</p>
            <p className="text-3xl font-bold">{data.assignments.length}</p>
          </div>
        </div>
      </div>

      {/* Detalle agrupado por materia */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([subject, items]) => {
          const campo = items[0].campo;
          const totalSubject = items.reduce((s, i) => s + i.hoursPerWeek, 0);
          return (
            <div key={subject} className="bg-white rounded-xl shadow border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <BookOpen size={18} className="text-[#1A3A7C]" />
                  <span className="font-semibold text-[#1A3A7C] text-lg">{subject}</span>
                  {campo && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${CAMPO_COLORS[campo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CAMPO_LABEL[campo] ?? campo}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-[#1A3A7C]">{totalSubject} hrs/sem</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{item.courseLabel}</span>
                      {item.educationType === 'BTH' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">BTH</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {item.hoursPerWeek} hrs/sem
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}