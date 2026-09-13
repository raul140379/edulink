import { apiFetch } from '@/lib/api'

export type LicenseRequestStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

export interface LicenseRequest {
  id:             number
  status:         LicenseRequestStatus
  startDate:      string
  endDate:        string
  reason:         string
  createdAt:      string
  student:        { id: number; firstName: string; lastName: string }
  reviewedAt:     string | null
  reviewNote:     string | null
  reviewedByName: string | null
}

export interface CreateLicenseRequestInput {
  studentId: number
  startDate: string // YYYY-MM-DD
  endDate:   string // YYYY-MM-DD
  reason:    string
}

export const licenciasApi = {
  create: (input: CreateLicenseRequestInput) =>
    apiFetch<{ message: string; request: LicenseRequest }>('/api/student-license-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getMine: () => apiFetch<LicenseRequest[]>('/api/student-license-requests/mine'),
}
