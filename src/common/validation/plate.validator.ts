import { registerDecorator, ValidationOptions } from 'class-validator';

// Formato antigo:   3 letras + 4 dígitos  (ex: ABC1234)
// Formato Mercosul: 3 letras + 1 dígito + 1 letra + 2 dígitos (ex: ABC1D23)
const PLATE_REGEX = /^[A-Za-z]{3}[0-9]([0-9]{3}|[A-Za-z][0-9]{2})$/;

export function isValidPlate(plate: string): boolean {
  return PLATE_REGEX.test(plate);
}

export function IsPlate(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'invalid_plate',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidPlate(value),
      },
    });
  };
}
