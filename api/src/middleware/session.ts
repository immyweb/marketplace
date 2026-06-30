import session from 'express-session';
import connectPg from 'connect-pg-simple';
import pg from 'pg';

const PgSession = connectPg(session);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET ?? 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
});
