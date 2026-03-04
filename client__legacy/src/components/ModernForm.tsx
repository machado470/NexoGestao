/**
 * ModernForm - Formulário com Validação em Tempo Real
 * Suporta inputs, selects, textareas com feedback visual
 */

import React, { useState } from "react";
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";

interface FormFieldProps {
  label: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "date" | "textarea" | "select";
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  success?: boolean;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  options?: { label: string; value: string }[];
  rows?: number;
  hint?: string;
}

export function FormField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  success,
  required,
  disabled,
  icon,
  options,
  rows = 4,
  hint,
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const baseClasses =
    "w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border transition-all duration-200 text-base font-medium";
  const borderClasses = error
    ? "border-red-300 dark:border-red-700 focus:ring-red-500"
    : success
      ? "border-green-300 dark:border-green-700 focus:ring-green-500"
      : "border-gray-200 dark:border-gray-700 focus:ring-orange-500";
  const focusClasses = "focus:outline-none focus:ring-2 focus:border-transparent";

  const inputClasses = `${baseClasses} ${borderClasses} ${focusClasses} ${
    icon ? "pl-12" : ""
  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {hint && <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </div>

      <div className="relative">
        {/* Icon */}
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}

        {/* Input */}
        {type === "textarea" ? (
          <textarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={rows}
            className={`${inputClasses} resize-none`}
          />
        ) : type === "select" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={inputClasses}
          >
            <option value="">{placeholder || "Selecione uma opção"}</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type === "password" && showPassword ? "text" : type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={inputClasses}
          />
        )}

        {/* Password Toggle */}
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}

        {/* Status Icons */}
        {error && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}
        {success && !error && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
            <CheckCircle className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && !error && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Validado com sucesso</span>
        </div>
      )}
    </div>
  );
}

/**
 * ModernFormGroup - Agrupa múltiplos campos
 */
interface ModernFormGroupProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function ModernFormGroup({
  children,
  title,
  description,
}: ModernFormGroupProps) {
  return (
    <div className="space-y-6">
      {(title || description) && (
        <div>
          {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>}
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/**
 * ModernFormActions - Botões de ação do formulário
 */
interface ModernFormActionsProps {
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
}

export function ModernFormActions({
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  isLoading = false,
  isDisabled = false,
}: ModernFormActionsProps) {
  return (
    <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={isLoading || isDisabled}
          className="flex-1 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
      )}
      <button
        onClick={onSubmit}
        disabled={isLoading || isDisabled}
        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
