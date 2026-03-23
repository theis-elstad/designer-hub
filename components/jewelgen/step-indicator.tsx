'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const STEPS = [
  { number: 1, label: 'Product' },
  { number: 2, label: 'Reference' },
  { number: 3, label: 'Settings' },
  { number: 4, label: 'Results' },
]

interface StepIndicatorProps {
  currentStep: number
  hasResults?: boolean
  onStepClick?: (step: number) => void
}

export function StepIndicator({ currentStep, hasResults, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => {
        const isComplete = currentStep > step.number || (step.number === 4 && hasResults)
        const isCurrent = currentStep === step.number
        const isClickable = onStepClick && (step.number < currentStep || (step.number === 4 && hasResults && currentStep !== 4))

        return (
          <div key={step.number} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(step.number)}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                isCurrent &&
                  'bg-primary text-primary-foreground',
                isComplete &&
                  'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20',
                !isCurrent &&
                  !isComplete &&
                  'bg-muted text-muted-foreground',
                !isClickable && !isCurrent && 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  isCurrent && 'bg-primary-foreground text-primary',
                  isComplete && 'bg-primary text-primary-foreground',
                  !isCurrent && !isComplete && 'bg-muted-foreground/20 text-muted-foreground'
                )}
              >
                {isComplete ? <Check className="h-3 w-3" /> : step.number}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-px w-6 sm:w-10',
                  currentStep > step.number ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
