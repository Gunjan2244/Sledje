import { BaseModel } from "./base.js";
import bcrypt from 'bcryptjs';
export class Retailer extends BaseModel {
  constructor() {
    super('retailers');
  }

  async create(data) {
    // Hash password before saving
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password_hash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }

    return super.create(data);
  }

  async matchPassword(retailerId, enteredPassword) {
    const retailer = await this.findById(retailerId);
    if (!retailer) return false;
    return await bcrypt.compare(enteredPassword, retailer.password_hash);
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async getConnectedDistributors(retailerId) {
    const query = `
      SELECT d.*, rdc.created_at as connection_date
      FROM distributors d
      JOIN retailer_distributor_connections rdc ON d.id = rdc.distributor_id
      WHERE rdc.retailer_id = $1
      ORDER BY rdc.created_at DESC
    `;
    const result = await this.query(query, [retailerId]);
    return result.rows;
  }

  async addDistributorConnection(retailerId, distributorId) {
    const query = `
      INSERT INTO retailer_distributor_connections (retailer_id, distributor_id)
      VALUES ($1, $2)
      ON CONFLICT (retailer_id, distributor_id) DO NOTHING
      RETURNING *
    `;
    const result = await this.query(query, [retailerId, distributorId]);
    return result.rows[0];
  }

  async removeDistributorConnection(retailerId, distributorId) {
    const query = `
      DELETE FROM retailer_distributor_connections 
      WHERE retailer_id = $1 AND distributor_id = $2
      RETURNING *
    `;
    const result = await this.query(query, [retailerId, distributorId]);
    return result.rows[0];
  }
}
