import waterSlothSrc from '../assets/openflow-water-sloth.webp'
import type { CSSProperties } from 'react'
import {
  WATER_SLOTH_MOTION_LABELS,
  type WaterSlothMotion,
} from '../waterSlothMotion.ts'

interface OpenFlowWaterSlothProps {
  motion: WaterSlothMotion
  size?: number
  label?: string
  className?: string
}

export function OpenFlowWaterSloth({
  motion,
  size = 52,
  label,
  className,
}: OpenFlowWaterSlothProps) {
  const accessibleLabel = label || WATER_SLOTH_MOTION_LABELS[motion]

  return (
    <span
      className={['openflow-water-sloth', `openflow-water-sloth--${motion}`, className]
        .filter(Boolean)
        .join(' ')}
      data-motion={motion}
      role="img"
      aria-label={accessibleLabel}
      style={{ '--water-sloth-size': `${size}px` } as CSSProperties}
    >
      <img src={waterSlothSrc} alt="" draggable={false} />
    </span>
  )
}
