import { isValidPlate } from './plate.validator';

describe('PlateValidator — Validação de Placa (1.6)', () => {
  describe('placas válidas', () => {
    it('ABC1234 — formato antigo', () => {
      expect(isValidPlate('ABC1234')).toBe(true);
    });

    it('abc1234 — antigo, case-insensitive', () => {
      expect(isValidPlate('abc1234')).toBe(true);
    });

    it('ABC1D23 — Mercosul', () => {
      expect(isValidPlate('ABC1D23')).toBe(true);
    });

    it('abc1d23 — Mercosul, case-insensitive', () => {
      expect(isValidPlate('abc1d23')).toBe(true);
    });
  });

  describe('placas inválidas', () => {
    it('ABC123 — curta demais', () => {
      expect(isValidPlate('ABC123')).toBe(false);
    });

    it('ABC12345 — longa demais', () => {
      expect(isValidPlate('ABC12345')).toBe(false);
    });

    it('1234ABC — ordem errada', () => {
      expect(isValidPlate('1234ABC')).toBe(false);
    });

    it('AB1234 — apenas 2 letras iniciais', () => {
      expect(isValidPlate('AB1234')).toBe(false);
    });

    it('ABCD234 — 4 letras iniciais', () => {
      expect(isValidPlate('ABCD234')).toBe(false);
    });

    it('"" (vazio) — ausente', () => {
      expect(isValidPlate('')).toBe(false);
    });

    it('ABC-1234 — com hífen', () => {
      expect(isValidPlate('ABC-1234')).toBe(false);
    });

    it('ABC 1234 — com espaço', () => {
      expect(isValidPlate('ABC 1234')).toBe(false);
    });
  });
});
