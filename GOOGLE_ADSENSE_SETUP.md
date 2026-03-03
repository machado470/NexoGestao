# Configuração do Google AdSense - NexoGestão

## 📋 Pré-requisitos

1. **Conta Google** - Você precisa ter uma conta Google
2. **Site/Domínio** - O site deve estar acessível publicamente
3. **Tráfego** - Google AdSense requer um mínimo de tráfego para aprovar

## 🚀 Passo a Passo

### 1. Criar Conta Google AdSense

1. Acesse [Google AdSense](https://www.google.com/adsense/start/)
2. Clique em **"Começar"**
3. Faça login com sua conta Google
4. Preencha as informações:
   - Nome do site: `NexoGestão`
   - URL do site: `seu-dominio.com`
   - Categoria do site: Negócios/Gestão
   - Idioma: Português
5. Clique em **"Enviar"**

### 2. Aguardar Aprovação

- Google levará **24-48 horas** para revisar sua solicitação
- Você receberá um email de confirmação
- Após aprovação, você terá acesso ao seu **Publisher ID** (ca-pub-xxxxxxxxxxxxxxxx)

### 3. Obter Seu Publisher ID e Ad Slots

1. Após aprovação, acesse [Google AdSense Dashboard](https://adsense.google.com/)
2. Vá para **"Anúncios"** > **"Por tamanho"**
3. Procure por:
   - **Vertical Banner (300x600)** - Para a coluna lateral
   - **Medium Rectangle (300x250)** - Para espaço adicional
4. Para cada tamanho, clique em **"Criar novo anúncio"**
5. Copie o **Ad Slot ID** (número após `data-ad-slot`)

### 4. Configurar no NexoGestão

#### Arquivo: `client/src/components/GoogleAdsPanel.tsx`

Substitua os valores de exemplo pelos seus:

```tsx
// Linha 9 - Seu Publisher ID
script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-AQUI_SEU_PUBLISHER_ID";

// Linhas 38 e 49 - Seu Publisher ID
data-ad-client="ca-pub-AQUI_SEU_PUBLISHER_ID"

// Linhas 39 e 50 - Seus Ad Slot IDs
data-ad-slot="AQUI_SEU_AD_SLOT_ID_1"
data-ad-slot="AQUI_SEU_AD_SLOT_ID_2"
```

**Exemplo completo:**
```tsx
script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456";

// Primeiro anúncio
data-ad-client="ca-pub-1234567890123456"
data-ad-slot="1234567890"

// Segundo anúncio
data-ad-client="ca-pub-1234567890123456"
data-ad-slot="0987654321"
```

### 5. Testar os Anúncios

1. Faça deploy do site
2. Acesse o dashboard em desktop
3. Você verá a coluna de anúncios na direita
4. Os anúncios podem levar **24-48 horas** para aparecer após a primeira configuração

## 📊 Tamanhos de Anúncios Recomendados

Para a coluna lateral (w-72 = 288px), recomendamos:

| Tamanho | Dimensões | Tipo | Recomendação |
|---------|-----------|------|--------------|
| Vertical Banner | 300x600 | Responsivo | ⭐ Melhor para coluna |
| Medium Rectangle | 300x250 | Responsivo | ⭐ Complementar |
| Leaderboard | 728x90 | Responsivo | Para topo |
| Wide Skyscraper | 160x600 | Responsivo | Alternativa |

## 💡 Dicas Importantes

1. **Não clique em seus próprios anúncios** - Google pode banir sua conta
2. **Não peça para outros clicarem** - Violação de políticas
3. **Deixe espaço adequado** - Não coloque muitos anúncios juntos
4. **Monitore o desempenho** - Use o dashboard do AdSense para ver ganhos
5. **Cumpra as políticas** - Leia as [Políticas do Google AdSense](https://support.google.com/adsense/answer/48182)

## 🔧 Troubleshooting

### Anúncios não aparecem
- Verifique se o site está aprovado no AdSense
- Confirme que Publisher ID e Ad Slot estão corretos
- Aguarde 24-48 horas após a primeira configuração
- Verifique se há tráfego no site

### Erro "Ads by Google"
- Isso é normal - significa que os anúncios estão carregando
- Aguarde alguns segundos

### Ganhos zerados
- Anúncios precisam de cliques/impressões para gerar receita
- Certifique-se de que há tráfego real no site

## 📞 Suporte

Para mais informações, visite:
- [Google AdSense Help Center](https://support.google.com/adsense)
- [AdSense Policy Center](https://support.google.com/adsense/answer/48182)
- [AdSense Community](https://support.google.com/adsense/community)

## 🎯 Próximas Ações

1. ✅ Criar conta Google AdSense
2. ✅ Obter Publisher ID e Ad Slots
3. ✅ Configurar no NexoGestão
4. ✅ Fazer deploy
5. ✅ Monitorar ganhos no dashboard AdSense
