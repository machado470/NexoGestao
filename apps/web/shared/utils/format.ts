/**
 * Utilitários de formatação - Padronização de datas, moeda, etc
 */

// ============ DATAS ============

/**
 * Converte timestamp para string formatada em pt-BR
 * @param timestamp - Unix timestamp em ms
 * @returns String formatada (ex: "02 de março de 2026 às 14:30")
 */
export function formatDate(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formata apenas a data sem hora
 * @param timestamp - Unix timestamp em ms
 * @returns String formatada (ex: "02/03/2026")
 */
export function formatDateOnly(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formata apenas a hora
 * @param timestamp - Unix timestamp em ms
 * @returns String formatada (ex: "14:30")
 */
export function formatTimeOnly(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formata data relativa (ex: "há 2 horas", "em 3 dias")
 * @param timestamp - Unix timestamp em ms
 * @returns String formatada
 */
export function formatRelativeDate(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'agora mesmo';
  if (diffMins < 60) return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  
  return formatDateOnly(date);
}

// ============ MOEDA ============

/**
 * Converte centavos para reais formatados
 * Backend usa centavos (inteiros), frontend exibe em reais
 * @param cents - Valor em centavos
 * @returns String formatada (ex: "R$ 1.234,56")
 */
export function formatCurrency(cents: number): string {
  const reais = cents / 100;
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
}

/**
 * Converte centavos para número decimal
 * @param cents - Valor em centavos
 * @returns Número em reais
 */
export function centsToBRL(cents: number): number {
  return cents / 100;
}

/**
 * Converte reais para centavos
 * @param reais - Valor em reais
 * @returns Número em centavos
 */
export function BRLToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Formata número como percentual
 * @param value - Valor entre 0 e 1
 * @returns String formatada (ex: "25,50%")
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============ NÚMEROS ============

/**
 * Formata número com separador de milhares
 * @param value - Número
 * @returns String formatada (ex: "1.234.567")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============ TELEFONE ============

/**
 * Formata telefone brasileiro
 * @param phone - String com apenas dígitos
 * @returns String formatada (ex: "(11) 98765-4321")
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  return phone;
}

// ============ CPF/CNPJ ============

/**
 * Formata CPF
 * @param cpf - String com apenas dígitos
 * @returns String formatada (ex: "123.456.789-00")
 */
export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  
  if (digits.length !== 11) return cpf;
  
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Formata CNPJ
 * @param cnpj - String com apenas dígitos
 * @returns String formatada (ex: "12.345.678/0001-90")
 */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  
  if (digits.length !== 14) return cnpj;
  
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// ============ CEP ============

/**
 * Formata CEP
 * @param cep - String com apenas dígitos
 * @returns String formatada (ex: "12345-678")
 */
export function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  
  if (digits.length !== 8) return cep;
  
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ============ SLUGS ============

/**
 * Cria slug a partir de texto
 * @param text - Texto para converter
 * @returns Slug (ex: "joao-silva-santos")
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-') // Espaços em hífens
    .replace(/-+/g, '-'); // Hífens múltiplos em um
}

// ============ TRUNCATE ============

/**
 * Trunca texto com ellipsis
 * @param text - Texto
 * @param length - Comprimento máximo
 * @returns Texto truncado
 */
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}
