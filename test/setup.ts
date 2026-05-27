import { DataSource } from 'typeorm';
import { typeOrmConfig } from '../src/config/typeorm.config';

let dataSource: DataSource;

export async function createTestDataSource(): Promise<DataSource> {
  dataSource = new DataSource({
    ...(typeOrmConfig as any),
    synchronize: true,
  });
  await dataSource.initialize();
  return dataSource;
}

export async function clearDatabase(ds: DataSource): Promise<void> {
  const entities = ds.entityMetadatas;
  for (const entity of entities) {
    const repo = ds.getRepository(entity.name);
    await repo.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`);
  }
}

export async function closeTestDataSource(ds: DataSource): Promise<void> {
  if (ds.isInitialized) {
    await ds.destroy();
  }
}
