import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { TermsModal } from "@/components/TermsModal";
import { FormField } from "@/components/ModernForm";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Loader, AlertCircle, CheckCircle, Mail, Lock, Building, User } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Register() {
  const [, navigate] = useLocation();
  const { register, loading, error } = useAuth();
  const [step, setStep] = useState<"register" | "success">("register");
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleAuthMutation = trpc.googleAuth.authenticate.useMutation();
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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setGoogleLoading(true);
      setLocalError(null);
      const result = await googleAuthMutation.mutateAsync({
        token: credentialResponse.credential,
      });
      if (result.success && result.user) {
        // Redirecionar direto para dashboard apos login com Google
        navigate("/dashboard");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro ao autenticar com Google");
    } finally {
      setGoogleLoading(false);
    }
  };

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

    // Validações
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 animate-slideInUp">
              Conta criada com sucesso!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 animate-slideInUp" style={{ animationDelay: "0.1s" }}>
              Um email de confirmação foi enviado para <strong>{formData.email}</strong>. Clique no link para ativar sua conta.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="modern-button modern-button-primary w-full py-3 animate-slideInUp"
              style={{ animationDelay: "0.2s" }}
            >
              Ir para Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 relative">
              <span className="relative inline-block">
                <span className="text-orange-500">Nexo</span>
                <span className="absolute inset-0 text-orange-500 opacity-0 blur-md animate-pulse" style={{animationDuration: '3s'}}>Nexo</span>
              </span>
              <span className="text-gray-900 dark:text-white">Gestão</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Crie sua conta</p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            {(error || localError) && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300">
                  {localError || error?.message || "Erro ao registrar"}
                </p>
              </div>
            )}

            {/* Google Sign-In */}
            <div className="mb-6">
              <GoogleSignIn
                onSuccess={handleGoogleSuccess}
                text="signup_with"
                size="large"
                theme="outline"
                width="100%"
              />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Ou continue com email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Organização *
                </label>
                <input
                  type="text"
                  name="orgName"
                  value={formData.orgName}
                  onChange={handleChange}
                  placeholder="Sua Empresa"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Seu Nome Completo
                </label>
                <input
                  type="text"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  placeholder="João Silva"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Mínimo 8 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 mt-1 flex-shrink-0"
                />
                <label htmlFor="agreeTerms" className="text-sm text-gray-600 dark:text-gray-400">
                  Concordo com os{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("terms")}
                    className="text-orange-500 hover:text-orange-600 underline"
                  >
                    termos de serviço
                  </button>{" "}
                  e{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("privacy")}
                    className="text-orange-500 hover:text-orange-600 underline"
                  >
                    política de privacidade
                  </button>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
              Já tem uma conta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-orange-500 hover:text-orange-600 font-medium"
              >
                Faça login
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showTermsModal && (
        <TermsModal
          isOpen={showTermsModal !== null}
          onClose={() => setShowTermsModal(null)}
          type={showTermsModal}
        />
      )}
    </>
  );
}
