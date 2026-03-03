export const runtime = 'edge'

import { Suspense } from 'react'
import { getOverdueTaskData } from '@/lib/actions/asana'
import { OverdueDashboard } from '@/components/overdue/overdue-dashboard'
import { OverdueSkeleton } from '@/components/overdue/overdue-skeleton'

async function OverdueContent() {
  const result = await getOverdueTaskData()

  if ('error' in result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-800 font-medium">Failed to load Asana data</p>
        <p className="text-red-600 text-sm mt-2">{result.error}</p>
      </div>
    )
  }

  return <OverdueDashboard data={result} />
}

export default function OverduePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Asana Task Overview</h1>
        <p className="text-gray-600 mt-1">
          Track overdue Asana tasks by pod and designer
        </p>
      </div>
      <Suspense fallback={<OverdueSkeleton />}>
        <OverdueContent />
      </Suspense>
    </div>
  )
}
