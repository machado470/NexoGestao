import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  details: {
    label: string;
    value: string;
  }[];
  technologies: string[];
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
}

const colorMap = {
  blue: "from-orange-500/20 to-orange-600/20 border-orange-300/50",
  green: "from-emerald-500/20 to-emerald-600/20 border-emerald-300/50",
  purple: "from-purple-500/20 to-purple-600/20 border-purple-300/50",
  orange: "from-orange-500/20 to-orange-600/20 border-orange-300/50",
};

export default function DetailModal({
  isOpen,
  onClose,
  title,
  description,
  details,
  technologies,
  icon,
  color,
}: DetailModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl overflow-hidden border border-slate-200/50 bg-white/95 p-0 backdrop-blur-md shadow-2xl dark:border-slate-700/50 dark:bg-slate-900/95">
        <DialogHeader
          className={`border-b border-slate-200/50 bg-gradient-to-r ${colorMap[color]} px-8 py-6 dark:border-slate-700/50`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{icon}</div>
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                  {title}
                </DialogTitle>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {description}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-white/20">
              <X className="h-6 w-6 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </DialogHeader>

        <div className="px-8 py-6">
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Detalhes</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.map((detail, index) => (
                <div key={index} className="rounded-lg bg-slate-50/50 p-4 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    {detail.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                    {detail.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Tecnologias</h3>
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech, index) => (
                <span
                  key={index}
                  className="inline-block rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 dark:bg-orange-500/20 dark:text-orange-200"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200/50 bg-slate-50/50 px-8 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
