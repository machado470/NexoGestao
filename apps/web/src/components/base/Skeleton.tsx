type Props = {
  className?: string
}

export default function Skeleton({ className }: Props) {
  return (
    <div
      className={`
        animate-pulse
        rounded-lg
        bg-black/10 dark:bg-white/10
        ${className ?? ''}
      `}
    />
  )
}
