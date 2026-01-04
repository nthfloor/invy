import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3010),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // Blnk Integration (optional)
  BLNK_ENABLED: Joi.boolean().default(false),
  BLNK_URL: Joi.string().when('BLNK_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  BLNK_API_KEY: Joi.string().optional().default(''),
});

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  blnk: {
    enabled: boolean;
    url: string;
    apiKey: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT || '3010', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invy',
  },
  blnk: {
    enabled: process.env.BLNK_ENABLED === 'true',
    url: process.env.BLNK_URL || 'http://localhost:5001',
    apiKey: process.env.BLNK_API_KEY || '',
  },
});
