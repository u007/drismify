import type { Config } from 'drizzle-kit';
import 'dotenv/config'; // To load .env file for potential future use

const config: Config = {
  dialect: 'sqlite',
  driver: 'libsql', 
  schema: './src/db/schema.ts', 
  out: './drizzle/migrations',   
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./dev.db', 
  },
  // verbose: true, 
  // strict: true,  
};

export default config;
