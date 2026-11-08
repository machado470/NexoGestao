import fs from "fs";
import path from "path";
export const ROOT_MARKUP = '<div id="root"></div>';
export const MIN_HTML_LENGTH_BYTES = 400;
const CLIENT_INDEX_PATH = path.resolve(import.meta.dirname, "../..", "client", "index.html");
export const HTML_FALLBACK = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NexoGestão - Fallback</title>
  </head>
  <body style="font-family: system-ui, sans-serif; margin: 0; background: #f3f4f6;">
    <div id="html-immediate-marker" style="min-height:100vh;display:grid;place-items:center;padding:16px;">
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:10px;padding:16px;max-width:860px;width:min(860px,100%);">
        <h1 style="margin:0 0 8px;">HTML carregado (fallback)</h1>
        <p style="margin:0;color:#4b5563;">O shell principal não foi carregado corretamente. Este fallback garante que o HTML nunca fique em branco.</p>
      </div>
    </div>
    <div id="root"></div>
  </body>
</html>`;

export function logHtmlDelivery(url: string, html: string, source: string, host: string | undefined) {
  const htmlSizeBytes = Buffer.byteLength(html, "utf-8");
  const snippet = html.slice(0, 200).replace(/\s+/g, " ");
  console.log("[HTML_DELIVERY] prepared", {
    url,
    source,
    host: host ?? "(unknown)",
    htmlSizeBytes,
    first200Chars: snippet,
  });
}

export async function loadClientHtml(url: string): Promise<{ html: string; source: string }> {
  const source = CLIENT_INDEX_PATH;
  const html = await fs.promises.readFile(source, "utf-8");

  if (Buffer.byteLength(html, "utf-8") < MIN_HTML_LENGTH_BYTES) {
    console.error("[web] html_too_small", {
      url,
      source,
      htmlSizeBytes: Buffer.byteLength(html, "utf-8"),
      minExpectedBytes: MIN_HTML_LENGTH_BYTES,
    });
    return { html: HTML_FALLBACK, source: `${source} (fallback)` };
  }

  return { html, source };
}

export function assertHtmlShell(template: string, source: string, mode: "vite" | "static") {
  if (!template.includes(ROOT_MARKUP)) {
    throw new Error(`[web] HTML shell inválido (${source}): #root não encontrado.`);
  }

  const hasModuleScript = /<script[^>]*type="module"[^>]*src="[^"]+"[^>]*>/.test(template);
  if (!hasModuleScript) {
    throw new Error(
      `[web] HTML shell inválido (${source}): script de entrada não encontrado em modo ${mode}.`
    );
  }
}

