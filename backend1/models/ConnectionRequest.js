import { BaseModel } from "./base.js";
export class ConnectionRequest extends BaseModel {
  constructor() {
    super('connection_requests');
  }

  async createRequest(data) {
    const query = `
      INSERT INTO connection_requests (retailer_id, distributor_id, requested_by, message)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (retailer_id, distributor_id) DO NOTHING
      RETURNING *
    `;
    const result = await this.query(query, [
      data.retailer_id,
      data.distributor_id,
      data.requested_by,
      data.message || ''
    ]);
    return result.rows[0];
  }

  async getRequestsWithDetails(userId, userType, status = null) {
    const userColumn = userType === 'distributor' ? 'distributor_id' : 'retailer_id';
    const joinTable = userType === 'distributor' ? 'retailers' : 'distributors';
    const joinColumn = userType === 'distributor' ? 'retailer_id' : 'distributor_id';
    
    let query = `
      SELECT 
        cr.*,
        u.business_name,
        u.owner_name,
        u.email,
        u.phone,
        u.location,
        u.business_type
      FROM connection_requests cr
      JOIN ${joinTable} u ON cr.${joinColumn} = u.id
      WHERE cr.${userColumn} = $1
    `;

    const params = [userId];

    if (status) {
      query += ` AND cr.status = ${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY cr.created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  async respond(requestId, action, rejectionReason = '') {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const query = `
      UPDATE connection_requests 
      SET status = $1, rejection_reason = $2, updated_at = NOW()
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `;
    const result = await this.query(query, [status, rejectionReason, requestId]);
    return result.rows[0];
  }
}