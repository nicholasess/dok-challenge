/**
 * Substitui todos os caracteres da placa por `***-****` para conformidade com a LGPD.
 * A placa nunca deve aparecer literal em logs ou saídas estruturadas.
 */
export function maskPlate(_placa: string): string {
  return '***-****';
}
