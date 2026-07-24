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
  PARENT:        'Padre / Tutor',
  STUDENT:       'Estudiante',
  STUDENT_GOV:   'Gobierno Estudiantil',
  STAFF:         'Personal',
  PORTERO:       'Portero',
}

export const ROLE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN:        { bg: '#1A3A7C', color: '#fff' },
  DIRECTOR_DISTRITAL: { bg: '#712B99', color: '#fff' },
  DIRECTOR:      { bg: '#0F6E56', color: '#fff' },
  REGENTE:       { bg: '#3C3489', color: '#fff' },
  SECRETARY:     { bg: '#712B13', color: '#fff' },
  TEACHER:       { bg: '#633806', color: '#fff' },
  TEACHER_TUTOR: { bg: '#0F6E56', color: '#fff' },
  DELEGATE:      { bg: '#444441', color: '#fff' },
  JUNTA_ESCOLAR: { bg: '#0F6E56', color: '#fff' },
  PARENT:        { bg: '#27500A', color: '#fff' },
  STUDENT:       { bg: '#1A7DB8', color: '#fff' },
  STUDENT_GOV:   { bg: '#1A7DB8', color: '#fff' },
  STAFF:         { bg: '#444', color: '#fff' },
  PORTERO:       { bg: '#0F172A', color: '#fff' },
}

export const GRADE_LABEL: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
