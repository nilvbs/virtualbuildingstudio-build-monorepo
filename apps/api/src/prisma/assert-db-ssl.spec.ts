import { connectionUsesSsl, assertProductionDatabaseSsl } from './assert-db-ssl';

describe('assert-db-ssl', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects sslmode=require', () => {
    expect(
      connectionUsesSsl('postgresql://u:p@h/db?schema=public&sslmode=require'),
    ).toBe(true);
  });

  it('rejects urls without ssl', () => {
    expect(connectionUsesSsl('postgresql://u:p@h/db?schema=public')).toBe(false);
  });

  it('throws in production when DATABASE_URL lacks SSL', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://u:p@h/db?schema=public';
    delete process.env.DIRECT_DATABASE_URL;
    expect(() => assertProductionDatabaseSsl()).toThrow(/sslmode/);
  });

  it('allows development without SSL', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://u:p@h/db?schema=public';
    expect(() => assertProductionDatabaseSsl()).not.toThrow();
  });
});
