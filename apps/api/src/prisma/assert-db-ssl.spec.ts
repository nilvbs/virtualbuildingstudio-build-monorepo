import {
  connectionUsesSsl,
  connectionLooksLikeLocalDocker,
  assertProductionDatabaseSsl,
} from './assert-db-ssl';

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

  it('flags docker compose db host', () => {
    expect(
      connectionLooksLikeLocalDocker(
        'postgresql://surveylink:surveylink@db:5432/surveylink?schema=public',
      ),
    ).toBe(true);
  });

  it('allows aurora host', () => {
    expect(
      connectionLooksLikeLocalDocker(
        'postgresql://u:p@bld-aurora-pg.cluster-xxx.us-east-2.rds.amazonaws.com:5432/surveylink?sslmode=require',
      ),
    ).toBe(false);
  });

  it('throws in production when DATABASE_URL lacks SSL', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://u:p@h/db?schema=public';
    delete process.env.DIRECT_DATABASE_URL;
    expect(() => assertProductionDatabaseSsl()).toThrow(/sslmode/);
  });

  it('throws in production when DATABASE_URL is local docker', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      'postgresql://surveylink:surveylink@db:5432/surveylink?schema=public&sslmode=require';
    delete process.env.DIRECT_DATABASE_URL;
    expect(() => assertProductionDatabaseSsl()).toThrow(/local Docker/);
  });

  it('allows development without SSL', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://u:p@h/db?schema=public';
    expect(() => assertProductionDatabaseSsl()).not.toThrow();
  });
});
