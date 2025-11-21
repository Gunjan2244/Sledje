import { getPool } from '../config/db.js';
export class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async query(text, params = []) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async findOne(conditions) {
    const { whereClause, values } = this.buildWhereClause(conditions);
    const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async find(conditions = {}, options = {}) {
    const { whereClause, values } = this.buildWhereClause(conditions);
    let query = `SELECT * FROM ${this.tableName} ${whereClause}`;
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = await this.query(query, values);
    return result.rows;
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause} 
      WHERE id = $1 
      RETURNING *
    `;
    
    const result = await this.query(query, [id, ...values]);
    return result.rows[0];
  }

  async delete(id) {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  buildWhereClause(conditions) {
    const keys = Object.keys(conditions);
    if (keys.length === 0) {
      return { whereClause: '', values: [] };
    }

    const clauses = [];
    const values = [];
    let paramIndex = 1;

    keys.forEach(key => {
      if (conditions[key] && typeof conditions[key] === 'object' && conditions[key].$in) {
        // Handle $in operator
        const inValues = conditions[key].$in;
        const placeholders = inValues.map(() => `$${paramIndex++}`).join(', ');
        clauses.push(`${key} IN (${placeholders})`);
        values.push(...inValues);
      } else if (conditions[key] && typeof conditions[key] === 'object' && conditions[key].$nin) {
        // Handle $nin operator
        const ninValues = conditions[key].$nin;
        const placeholders = ninValues.map(() => `$${paramIndex++}`).join(', ');
        clauses.push(`${key} NOT IN (${placeholders})`);
        values.push(...ninValues);
      } else {
        clauses.push(`${key} = $${paramIndex++}`);
        values.push(conditions[key]);
      }
    });

    return {
      whereClause: `WHERE ${clauses.join(' AND ')}`,
      values
    };
  }
}

