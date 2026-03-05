import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definido en las variables de entorno");
}

export const pool = new Pool({
  connectionString,
});

export async function query<T = any>(text: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(text, params);
    return result;
  } finally {
    client.release();
  }
}

