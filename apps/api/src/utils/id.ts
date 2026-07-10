/**
 * Gera um ID único com prefixo legível
 * Formato: {prefix}_{timestamp_base36}_{random_base36}
 * Exemplo: tsk_lzf8k2_a3x9p
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${timestamp}_${random}`
}
