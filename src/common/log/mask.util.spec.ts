import { maskPlate } from './mask.util';

describe('maskPlate — Mascaramento de placa para LGPD', () => {
  it('placa formato antigo → retorna string mascarada sem expor a placa original', () => {
    const result = maskPlate('ABC1234');
    expect(result).not.toContain('ABC1234');
  });

  it('placa Mercosul → retorna string mascarada sem expor a placa original', () => {
    const result = maskPlate('ABC1D23');
    expect(result).not.toContain('ABC1D23');
  });

  it('placa vazia → retorna string mascarada sem expor a entrada', () => {
    const result = maskPlate('');
    expect(typeof result).toBe('string');
    expect(result).toBe('***-****');
  });

  it('retorno é sempre a máscara fixa independente da entrada', () => {
    expect(maskPlate('XYZ9876')).toBe('***-****');
    expect(maskPlate('ABC1234')).toBe('***-****');
    expect(maskPlate('ABC1D23')).toBe('***-****');
  });
});
