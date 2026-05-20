export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    public readonly type?: string,
  ) {
    super(code);
    this.name = 'BusinessError';
  }
}
