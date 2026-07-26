'use client'

import { useDistrictConfig } from '@/hooks/useDistrictConfig'

export default function PorteroHeaderLoc() {
  const district = useDistrictConfig()
  return (
    <div style={{ fontSize: 11, color: '#94A3B8' }}>
      U.E. Naciones Unidas{district.location ? ` — ${district.location}` : ''}
    </div>
  )
}
