import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--app-card, var(--popover))",
          "--normal-text": "var(--app-text, var(--popover-foreground))",
          "--normal-border": "var(--app-border, var(--border))",
          "--success-bg": "color-mix(in srgb, var(--success) 12%, var(--app-card, var(--popover)))",
          "--success-text": "color-mix(in srgb, var(--success) 76%, var(--app-text, var(--popover-foreground)))",
          "--success-border": "color-mix(in srgb, var(--success) 34%, var(--app-border, var(--border)))",
          "--error-bg": "color-mix(in srgb, var(--danger) 12%, var(--app-card, var(--popover)))",
          "--error-text": "color-mix(in srgb, var(--danger) 82%, var(--app-text, var(--popover-foreground)))",
          "--error-border": "color-mix(in srgb, var(--danger) 38%, var(--app-border, var(--border)))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
