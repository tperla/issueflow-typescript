describe('typeOrmConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses default values when env vars are not set', async () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;

    const { typeOrmConfig } = await import('./typeorm.config');

    const cfg = typeOrmConfig as any;
    expect(cfg.type).toBe('postgres');
    expect(cfg.host).toBe('localhost');
    expect(cfg.port).toBe(5432);
    expect(cfg.username).toBe('issueflow');
    expect(cfg.password).toBe('issueflow');
    expect(cfg.database).toBe('issueflow');
    expect(cfg.synchronize).toBe(true);
  });

  it('uses environment variables when set', async () => {
    process.env.DB_HOST = 'db-host';
    process.env.DB_PORT = '5433';
    process.env.DB_USER = 'myuser';
    process.env.DB_PASSWORD = 'mypass';
    process.env.DB_NAME = 'mydb';

    const { typeOrmConfig } = await import('./typeorm.config');

    const cfg = typeOrmConfig as any;
    expect(cfg.host).toBe('db-host');
    expect(cfg.port).toBe(5433);
    expect(cfg.username).toBe('myuser');
    expect(cfg.password).toBe('mypass');
    expect(cfg.database).toBe('mydb');
  });
});
