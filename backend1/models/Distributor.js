import { BaseModel } from "./base.js";
import bcrypt from 'bcryptjs';
export class Distributor extends BaseModel {
  constructor() {
    super('distributors');
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

  async matchPassword(distributorId, enteredPassword) {
    const distributor = await this.findById(distributorId);
    if (!distributor) return false;
    return await bcrypt.compare(enteredPassword, distributor.password_hash);
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async getConnectedRetailers(distributorId) {
    const query = `
      SELECT r.*, rdc.created_at as connection_date
      FROM retailers r
      JOIN retailer_distributor_connections rdc ON r.id = rdc.retailer_id
      WHERE rdc.distributor_id = $1
      ORDER BY rdc.created_at DESC
    `;
    const result = await this.query(query, [distributorId]);
    return result.rows;
  }

  async addRetailerConnection(distributorId, retailerId) {
    const query = `
      INSERT INTO retailer_distributor_connections (retailer_id, distributor_id)
      VALUES ($1, $2)
      ON CONFLICT (retailer_id, distributor_id) DO NOTHING
      RETURNING *
    `;
    const result = await this.query(query, [retailerId, distributorId]);
    return result.rows[0];
  }
}