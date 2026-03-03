/**
 * ModernCard - Componente de Card Reutilizável
 * Com ícones, gradientes, spacing e animações
 */

import React from "react";
import { LucideIcon } from "lucide-react";

interface ModernCardProps {
  icon?: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "blue" | "orange" | "green" | "purple" | "red";
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const colorMap = {
  blue: {
    gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    icon: "text-blue-500",
    border: "border-blue-200 dark:border-blue-800",
  },
  orange: {
    gradient: "from-orange-500 to-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    icon: "text-orange-500",
    border: "border-orange-200 dark:border-orange-800",
  },
  green: {
    gradient: "from-green-500 to-green-600",
    bg: "bg-green-50 dark:bg-green-900/20",
    icon: "text-green-500",
    border: "border-green-200 dark:border-green-800",
  },
  purple: {
    gradient: "from-purple-500 to-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    icon: "text-purple-500",
    border: "border-purple-200 dark:border-purple-800",
  },
  red: {
    gradient: "from-red-500 to-red-600",
    bg: "bg-red-50 dark:bg-red-900/20",
    icon: "text-red-500",
    border: "border-red-200 dark:border-red-800",
  },
};

export function ModernCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  color = "blue",
  onClick,
  className = "",
  children,
}: ModernCardProps) {
  const colors = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-2xl border bg-white dark:bg-gray-800
        border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg
        transition-all duration-300 hover:scale-105 cursor-pointer
        ${className}
      `}
    >
      {/* Background Gradient Accent */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${colors.gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`}
      />

      {/* Content */}
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                {value}
              </h3>
              {trend && (
                <div
                  className={`text-sm font-semibold ${
                    trend.isPositive
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {trend.isPositive ? "+" : "-"}
                  {Math.abs(trend.value)}%
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {subtitle}
              </p>
            )}
          </div>

          {/* Icon */}
          {Icon && (
            <div className={`p-3 rounded-xl ${colors.bg} ${colors.icon}`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Children */}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </div>
  );
}

/**
 * ModernCardGrid - Grid de Cards com Responsividade
 */
interface ModernCardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
}

export function ModernCardGrid({
  children,
  columns = 3,
}: ModernCardGridProps) {
  const colsMap = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid grid-cols-1 ${colsMap[columns]} gap-4 md:gap-6`}>
      {children}
    </div>
  );
}
