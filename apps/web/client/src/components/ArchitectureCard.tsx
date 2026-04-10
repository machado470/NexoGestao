import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ArchitectureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  color: "blue" | "green" | "purple" | "orange";
  technologies?: string[];
  delay?: number;
  onClick?: () => void;
}

const colorMap = {
  blue: "from-orange-500/20 to-orange-600/20 border-orange-300/50 hover:border-orange-400/80",
  green: "from-emerald-500/20 to-emerald-600/20 border-emerald-300/50 hover:border-emerald-400/80",
  purple: "from-purple-500/20 to-purple-600/20 border-purple-300/50 hover:border-purple-400/80",
  orange: "from-orange-500/20 to-orange-600/20 border-orange-300/50 hover:border-orange-400/80",
};

const iconColorMap = {
  blue: "text-orange-600",
  green: "text-emerald-600",
  purple: "text-purple-600",
  orange: "text-orange-600",
};

export default function ArchitectureCard({
  title,
  description,
  icon,
  color,
  technologies = [],
  delay = 0,
  onClick,
}: ArchitectureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.05, y: -5 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border backdrop-blur-sm bg-gradient-to-br p-6 transition-all duration-300 cursor-pointer group ${colorMap[color]}`}
    >
      {/* Background gradient effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Icon */}
        <div className={`mb-4 inline-flex rounded-lg bg-white/10 p-3 ${iconColorMap[color]}`}>
          <div className="text-2xl">{icon}</div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>

        {/* Description */}
        <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">
          {description}
        </p>

        {/* Technologies */}
        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {technologies.map((tech, index) => (
              <span
                key={index}
                className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {/* Hover indicator */}
        <div className="absolute bottom-0 right-0 h-1 w-0 bg-gradient-to-r from-transparent to-current transition-all duration-300 group-hover:w-full" />
      </div>
    </motion.div>
  );
}
