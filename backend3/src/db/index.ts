import { Pool } from 'pg';


export const pool = new Pool({
connectionString: process.env.DATABASE_URL || 'postgres://app:secret@localhost:5432/appdb'
});


export async function query(text: string, params?: any[]) {
return pool.query(text, params);
}