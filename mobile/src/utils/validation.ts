// Mismas reglas que el backend (CreateUserDto): correo @anahuac.mx y contraseña de 8 a 128
export const ANAHUAC_EMAIL = /^[A-Za-z0-9._%+-]+@anahuac\.mx$/i;

export const MIN_PASSWORD = 8;

export function emailError(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Escribe tu correo institucional';
  if (!ANAHUAC_EMAIL.test(value)) return 'Usa tu correo institucional (@anahuac.mx)';
  return null;
}

export function passwordError(password: string, forRegister = false): string | null {
  if (!password) return 'Escribe tu contraseña';
  if (forRegister && password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  return null;
}
