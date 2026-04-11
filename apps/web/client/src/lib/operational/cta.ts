export type OperationalCta = {
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
};

export function buildOperationalCTA(cta: OperationalCta): OperationalCta {
  return cta;
}
