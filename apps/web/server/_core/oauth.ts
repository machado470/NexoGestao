/**
 * OAuth module (placeholder).
 * Antiga versão dependia do DB local.
 *
 * O boot do server espera: registerOAuthRoutes()
 * Então a gente fornece uma versão neutra que não registra nada.
 */

export function registerOAuthRoutes(_app?: any) {
  console.log("[OAuth] registerOAuthRoutes placeholder (nenhuma rota registrada)");
}

// opcional: mantém compatibilidade se algum lugar ainda chamar initOAuth
export function initOAuth() {
  console.log("[OAuth] initOAuth placeholder");
}
