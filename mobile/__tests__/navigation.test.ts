/// <reference types="jest" />
import { homeFor } from '~/features/auth/navigation';

jest.mock('~/lib/supabase', () => ({ supabase: {} }));
jest.mock('~/features/push/push', () => ({ unregisterPush: jest.fn() }));

describe('pantalla de inicio de cada rol al entrar', () => {
  const complete = { phone: '+50584537341', department_id: 1 };
  it('lleva cada rol directo a su panel', () => {
    expect(homeFor({ role: 'vendor', ...complete })).toBe('/vendedor/panel');
    expect(homeFor({ role: 'courier', phone: '+50584537341', department_id: null })).toBe('/repartidor');
    expect(homeFor({ role: 'admin', ...complete })).toBe('/solo-web');
  });

  it('el cliente vuelve a donde iba, o al inicio', () => {
    expect(homeFor({ role: 'customer', ...complete }, '/checkout/abc')).toBe('/checkout/abc');
    expect(homeFor({ role: 'customer', ...complete })).toBe('/');
  });

  it('pide completar el perfil antes que nada', () => {
    expect(homeFor({ role: 'vendor', phone: null, department_id: null })).toBe('/completar-perfil');
  });
});
