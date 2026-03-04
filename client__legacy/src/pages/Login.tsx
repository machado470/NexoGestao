import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, Users, BarChart3, Shield, Zap } from "lucide-react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleAuthMutation = trpc.googleAuth.authenticate.useMutation();

  const handleGoogleSuccess = useCallback(async (credentialResponse: any) => {
    try {
      console.log('handleGoogleSuccess called with:', credentialResponse);
      setGoogleLoading(true);
      setLocalError(null);
      const result = await googleAuthMutation.mutateAsync({
        token: credentialResponse.credential,
      });
      console.log('Google auth result:', result);
      if (result.success && result.user) {
        navigate("/dashboard");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro ao autenticar com Google");
    } finally {
      setGoogleLoading(false);
    }
  }, [googleAuthMutation, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("Por favor, preencha todos os campos");
      return;
    }

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro ao fazer login");
    }
  };

  const features = [
    {
      icon: Users,
      title: "Gestão de Clientes",
      description: "Centralize todas as informações de clientes em um único lugar"
    },
    {
      icon: BarChart3,
      title: "Análise de Dados",
      description: "Visualize métricas importantes em tempo real"
    },
    {
      icon: Shield,
      title: "Governança Inteligente",
      description: "Análise de risco automática e conformidade"
    },
    {
      icon: Zap,
      title: "Automação",
      description: "Automatize processos repetitivos e economize tempo"
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-poppins flex items-center justify-center relative overflow-hidden">
      {/* Background SVG Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-5">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="#F97316"></path>
          <path d="M0,0 C30,20 70,20 100,0 L100,100 L0,100 Z" fill="#F97316" opacity="0.5"></path>
        </svg>
      </div>

      <div className="w-full h-screen flex relative z-10">
        {/* Left Column - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            {/* Logo Section */}
            <div className="text-center mb-8 animate-slideInUp">
              <h1 className="text-4xl font-bold mb-2 relative">
                <span className="relative inline-block">
                  <span className="text-orange-500">Nexo</span>
                  <span className="absolute inset-0 text-orange-500 opacity-0 blur-md animate-pulse" style={{animationDuration: '3s'}}>Nexo</span>
                </span>
                <span className="text-gray-900 dark:text-white">Gestão</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">Bem-vindo de volta</p>
            </div>

            {/* Form Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700 animate-slideInUp" style={{ animationDelay: "0.1s" }}>
              {/* Error Alert */}
              {(error || localError) && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 animate-slideInDown">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300">
                    {localError || error?.message || "Erro ao fazer login"}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="animate-slideInUp" style={{ animationDelay: "0.2s" }}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="animate-slideInUp" style={{ animationDelay: "0.3s" }}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember & Forgot Password */}
                <div className="flex items-center justify-between animate-slideInUp" style={{ animationDelay: "0.4s" }}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Manter-me conectado
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 font-medium transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all transform hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:shadow-none animate-slideInUp"
                  style={{ animationDelay: "0.5s" }}
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Ou</span>
                </div>
              </div>

              {/* Google Sign In */}
              <div className="mb-6 animate-slideInUp" style={{ animationDelay: "0.55s" }}>
                <GoogleSignIn
                  text="signin_with"
                  size="large"
                  theme="outline"
                  width="100%"
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    setLocalError("Erro ao fazer login com Google");
                  }}
                />
              </div>

              {/* Sign Up Link */}
              <div className="text-center animate-slideInUp" style={{ animationDelay: "0.6s" }}>
                <p className="text-gray-600 dark:text-gray-400">
                  Não tem uma conta?{" "}
                  <button
                    onClick={() => navigate("/register")}
                    className="text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 font-bold transition-colors"
                  >
                    Criar conta
                  </button>
                </p>
              </div>
            </div>


          </div>
        </div>

        {/* Right Column - Features (Desktop Only) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-900 items-center justify-center p-8 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-200 dark:bg-orange-900/20 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-300 dark:bg-orange-900/30 rounded-full blur-3xl opacity-20"></div>

          <div className="relative z-10 max-w-md">
            {/* Header */}
            <div className="mb-12 animate-slideInRight">
              <h2 className="text-4xl font-bold mb-4">
                <span className="text-orange-500">Nexo</span>
                <span className="text-gray-900 dark:text-white">Gestão</span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                Tudo que você precisa para gerenciar seu negócio em um único lugar
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-6">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 animate-slideInRight"
                  style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-orange-500 text-white">
                      <feature.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-12 pt-8 border-t border-gray-300 dark:border-gray-700 animate-slideInRight" style={{ animationDelay: "0.5s" }}>
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Segurança garantida</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Seus dados estão protegidos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Suporte 24/7</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Estamos sempre aqui para ajudar</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
