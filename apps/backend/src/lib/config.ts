type Env = {
  DATABASE_URL: string;
  PORT: number;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  APP_URL: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET_RULES: string;
  S3_BUCKET_SUBMISSIONS: string;
  S3_FORCE_PATH_STYLE: boolean;
  EMAIL_PROVIDER: 'console' | 'sendgrid';
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM: string;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://robocon:password@localhost:5432/robocon',
  PORT: Number(process.env.PORT ?? 8787),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'dev-secret',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:8787',
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'minioadmin',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'minioadmin',
  S3_BUCKET_RULES: process.env.S3_BUCKET_RULES ?? 'robocon-rules',
  S3_BUCKET_SUBMISSIONS: process.env.S3_BUCKET_SUBMISSIONS ?? 'robocon-submissions',
  S3_FORCE_PATH_STYLE: toBool(process.env.S3_FORCE_PATH_STYLE, true),
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER === 'sendgrid' ? 'sendgrid' : 'console',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM: process.env.SENDGRID_FROM ?? 'noreply@example.com',
};
