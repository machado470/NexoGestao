# Perfil e Configurações no mobile — 17/11/2026

Perfil e Configurações usam o cabeçalho compacto dos módulos internos, campos de pelo menos 48 px e texto de 16 px para evitar zoom ao editar no celular. O Perfil mantém a identidade somente leitura, mostra contadores em duas colunas e recolhe capacidade profissional no celular. A última atividade respeita o fuso da organização; datas inválidas não aparecem como datas válidas.

Configurações mantém exclusivamente nome, fuso e moeda como campos editáveis e preserva a seção de acessos e as permissões existentes. Descartar pede confirmação; cancelar preserva o rascunho. O formulário com alterações registra beforeunload, removido quando deixa de estar alterado. O reducer existente continua preservando edições diante de atualização dos dados.

Limite: beforeunload protege recarga/saída do documento quando suportado pelo navegador. Não bloqueia navegação interna da SPA nem o botão Voltar. A tela orienta salvar ou descartar antes de trocar de tela. Não há edição de identidade, senha ou novos endpoints.

Validação local: 30 testes de contratos, reducer e validação; TypeScript; build Vite; Playwright em 320, 390, 768 e 1280 px sem transbordamento horizontal. O roteiro scripts/audits/mobile-account-settings.cjs verifica identidade somente leitura, cancelamento/descarte, proteção de recarga e ausência de writes. Usa respostas simuladas locais; não valida produção nem altera dados reais.
