export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:        'Super Administrador',
  DIRECTOR_DISTRITAL: 'Director Distrital',
  DIRECTOR:      'Director',
  REGENTE:       'Regente',
  SECRETARY:     'Secretaria',
  TEACHER:       'Maestro',
  TEACHER_TUTOR: 'Maestro Tutor',
  DELEGATE:      'Delegado',
  JUNTA_ESCOLAR: 'Junta Escolar',
  JUNTA_NUCLEO:      'Junta de Núcleo',
  JUNTA_DISTRITO:    'Junta de Distrito',
  PARENT:        'Padre / Tutor',
  STUDENT:       'Estudiante',
  STUDENT_GOV:   'Gobierno Estudiantil',
  GOBIERNO_NUCLEO:   'Gob. Estudiantil de Núcleo',
  GOBIERNO_DISTRITO: 'Gob. Estudiantil de Distrito',
  STAFF:         'Personal',
  PORTERO:       'Portero',
}

// Colores agrupados por familia de dashboard (mismo criterio que los theme={{...}}
// de cada layout): Distrito/Directores = verde, Junta = teal, Gobierno/Estudiantes
// = dorado, Docentes = violeta, Portería = pizarra.
export const ROLE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN:        { bg: '#0A5A45', color: '#fff' },
  DIRECTOR_DISTRITAL: { bg: '#0A5A45', color: '#fff' },
  DIRECTOR:      { bg: '#0F6E56', color: '#fff' },
  REGENTE:       { bg: '#14876A', color: '#fff' },
  SECRETARY:     { bg: '#073F30', color: '#fff' },
  TEACHER:       { bg: '#5A358D', color: '#fff' },
  TEACHER_TUTOR: { bg: '#6D44A7', color: '#fff' },
  DELEGATE:      { bg: '#2790A5', color: '#fff' },
  JUNTA_ESCOLAR: { bg: '#136272', color: '#fff' },
  JUNTA_NUCLEO:      { bg: '#1A7789', color: '#fff' },
  JUNTA_DISTRITO:    { bg: '#0C4955', color: '#fff' },
  PARENT:        { bg: '#2790A5', color: '#fff' },
  STUDENT:       { bg: '#8F6A14', color: '#fff' },
  STUDENT_GOV:   { bg: '#B88714', color: '#fff' },
  GOBIERNO_NUCLEO:   { bg: '#B88714', color: '#fff' },
  GOBIERNO_DISTRITO: { bg: '#6D500D', color: '#fff' },
  STAFF:         { bg: '#344551', color: '#fff' },
  PORTERO:       { bg: '#344551', color: '#fff' },
}

export const GRADE_LABEL: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
