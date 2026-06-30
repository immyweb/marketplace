import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'
import { resolve } from 'node:path'

// Prisma skips .env loading when prisma.config.ts is present, so load it here
config({ path: resolve(__dirname, '.env') })

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
}))
