import IconBase from '../base/IconBase'

export function CheckIcon(props: any) {
  return (
    <IconBase {...props}>
      <path d="M20 6L9 17l-5-5" />
    </IconBase>
  )
}

export function TrendUpIcon(props: any) {
  return (
    <IconBase {...props}>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </IconBase>
  )
}

export function ShieldIcon(props: any) {
  return (
    <IconBase {...props}>
      <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
    </IconBase>
  )
}

export function AlertIcon(props: any) {
  return (
    <IconBase {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86l-7.4 12.8a2 2 0 001.71 3h14.8a2 2 0 001.71-3l-7.4-12.8a2 2 0 00-3.42 0z" />
    </IconBase>
  )
}

export function ArrowRightIcon(props: any) {
  return (
    <IconBase {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </IconBase>
  )
}
