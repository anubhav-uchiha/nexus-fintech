import 'dotenv/config';

import { defineConfig } from 'prisma/config';

import * as path from 'path';

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),

  migrations: {
    path: path.join(__dirname, 'prisma/migrations'),
  },

  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:admin@localhost:5432/aeps_db',
  },
});
