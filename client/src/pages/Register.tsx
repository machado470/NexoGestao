import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { TermsModal } from "@/components/TermsModal";
import { Loader, AlertCircle, CheckCircle, Mail, Lock, Building2, User, ArrowRight, Check } from "lucide-react";

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

    if (formData.password.length < 8) {
      setLocalError("A senha deve ter no mínimo 8 caracteres");
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
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Mínimo 8 caracteres
                </p>
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
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="w-5 h-5 rounded-lg border-2 border-gray-300 dark:border-slate-600 text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 dark:focus:ring-offset-slate-800 cursor-pointer mt-1"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  Concordo com os{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("terms")}
                    className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                  >
                    Termos de Serviço
                  </button>{" "}
                  e{" "}
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
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-8"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar Conta
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                  Ou
                </span>
              </div>
            </div>

            {/* Login Link */}
            <p className="text-center text-gray-600 dark:text-gray-400">
              Já tem conta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold transition"
              >
                Entrar agora
              </button>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-8">
            Seus dados são protegidos com criptografia de ponta a ponta
          </p>
        </div>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <TermsModal
          isOpen={true}
          type={showTermsModal}
          onClose={() => setShowTermsModal(null)}
        />
      )}
    </>
  );
}
