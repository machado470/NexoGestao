import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { TermsModal } from "@/components/TermsModal";
import { Loader, AlertCircle, CheckCircle, Mail, Lock, Building2, User, ArrowRight, Check, X } from "lucide-react";

// Função para validar força de senha
function getPasswordStrength(password: string) {
  let strength = 0;
  const feedback = [];

  if (!password) return { strength: 0, feedback: [] };

  // Comprimento
  if (password.length >= 8) strength += 1;
  else feedback.push("Mínimo 8 caracteres");

  if (password.length >= 12) strength += 1;
  else if (password.length >= 8) feedback.push("Use 12+ caracteres para mais segurança");

  // Maiúsculas
  if (/[A-Z]/.test(password)) strength += 1;
  else feedback.push("Adicione letras maiúsculas");

  // Minúsculas
  if (/[a-z]/.test(password)) strength += 1;
  else feedback.push("Adicione letras minúsculas");

  // Números
  if (/[0-9]/.test(password)) strength += 1;
  else feedback.push("Adicione números");

  // Caracteres especiais
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 1;
  else feedback.push("Adicione caracteres especiais (!@#$%^&*)");

  return {
    strength: Math.min(strength, 5),
    feedback,
    isStrong: strength >= 4,
  };
}

export default function Register() {
  const [, navigate] = useLocation();
  const { register, loading, error } = useAuth();
  const [step, setStep] = useState<"register" | "success">("register");
  const [showTermsModal, setShowTermsModal] = useState<"terms" | "privacy" | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    orgName: "",
    adminName: "",
    agreeTerms: false,
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.orgName || !formData.adminName) {
      setLocalError("Por favor, preencha todos os campos");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError("As senhas não coincidem");
      return;
    }

    if (!passwordStrength.isStrong) {
      setLocalError("A senha não é forte o suficiente. Siga as recomendações acima");
      return;
    }

    if (!formData.agreeTerms) {
      setLocalError("Você deve concordar com os termos de serviço");
      return;
    }

    try {
      await register(formData.email, formData.password, formData.orgName, formData.adminName || "Admin");
      setStep("success");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro ao registrar");
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-slate-700 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 mb-6 border border-green-200 dark:border-green-800">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Conta criada com sucesso!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              Um email de confirmação foi enviado para <strong className="text-gray-900 dark:text-white">{formData.email}</strong>. Clique no link para ativar sua conta.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              Ir para Login <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-2xl mb-6 shadow-lg">
              N
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              NexoGestão
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Crie sua conta e comece grátis
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-slate-700 backdrop-blur-sm">
            {/* Error Alert */}
            {(error || localError) && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 animate-in">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                  {localError || error?.message || "Erro ao registrar"}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Empresa
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    name="orgName"
                    value={formData.orgName}
                    onChange={handleChange}
                    placeholder="Sua Empresa"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Admin Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Seu Nome
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    name="adminName"
                    value={formData.adminName}
                    onChange={handleChange}
                    placeholder="João Silva"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-3 space-y-2">
                    {/* Strength Bar */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength.strength
                              ? level <= 2
                                ? "bg-red-500"
                                : level <= 3
                                ? "bg-yellow-500"
                                : "bg-green-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Feedback */}
                    <div className="space-y-1">
                      {passwordStrength.feedback.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <X className="w-3 h-3 text-red-500" />
                          {item}
                        </div>
                      ))}
                      {passwordStrength.isStrong && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <Check className="w-3 h-3" />
                          Senha forte!
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Senhas coincidem
                  </p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-orange-500 focus:ring-orange-500 mt-1 cursor-pointer"
                />
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  Concordo com os{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("terms")}
                    className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                  >
                    Termos de Serviço
                  </button>
                  {" "}e{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("privacy")}
                    className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                  >
                    Política de Privacidade
                  </button>
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar Conta <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              {/* Login Link */}
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                >
                  Faça login
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal !== null}
        type={showTermsModal || "terms"}
        onClose={() => setShowTermsModal(null)}
      />
    </>
  );
}
