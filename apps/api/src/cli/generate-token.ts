import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';
import { generateApiToken, generateTokenId } from '../shared/auth/token.utils';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const name = process.argv[2] || 'Default Token';

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invy',
    entities: [ApiTokenEntity],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Connected to database');

    const { token, hashedToken } = generateApiToken();

    const apiToken = dataSource.getRepository(ApiTokenEntity).create({
      id: generateTokenId(),
      token: hashedToken,
      name,
      isActive: true,
    });

    await dataSource.getRepository(ApiTokenEntity).save(apiToken);

    console.log('\n=== API Token Generated ===');
    console.log(`Name: ${name}`);
    console.log(`Token ID: ${apiToken.id}`);
    console.log(`\nAPI Token (save this - it cannot be retrieved later):`);
    console.log(`\n  ${token}\n`);
    console.log('Use this token in the Authorization header:');
    console.log(`  Authorization: Bearer ${token}\n`);
  } catch (error) {
    console.error('Error generating token:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

void main();
