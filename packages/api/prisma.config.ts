import { config } from 'dotenv'
import { resolve } from 'node:path'

// Prisma 7 does not load .env automatically — load it here
config({ path: resolve(__dirname, '.env') })

export default {
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
}
