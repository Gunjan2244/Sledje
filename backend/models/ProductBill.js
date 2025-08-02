import { BaseModel } from "./base.js";
export class ProductBill extends BaseModel {
  constructor() {
    super('product_bills');
  }

  async createOrUpdate(data) {
    const query = `
      INSERT INTO product_bills (
        retailer_id, distributor_id, product_id, variant_id, sku, current_unit_price
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (retailer_id, distributor_id, product_id, variant_id)
      DO UPDATE SET 
        current_unit_price = EXCLUDED.current_unit_price,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await this.query(query, [
      data.retailer_id,
      data.distributor_id,
      data.product_id,
      data.variant_id,
      data.sku,
      data.current_unit_price
    ]);
    return result.rows[0];
  }

  async addTransaction(billId, transactionData) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Add transaction
      const transactionQuery = `
        INSERT INTO product_bill_transactions (
          product_bill_id, type, quantity, unit_price, amount, note, 
          order_id, payment_method, reference_number, created_by, created_by_model
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const transactionResult = await client.query(transactionQuery, [
        billId,
        transactionData.type,
        transactionData.quantity || 0,
        transactionData.unit_price || 0,
        transactionData.amount,
        transactionData.note || '',
        transactionData.order_id || null,
        transactionData.payment_method || null,
        transactionData.reference_number || null,
        transactionData.created_by,
        transactionData.created_by_model
      ]);

      // Update bill totals based on transaction type
      let updateQuery = '';
      const updateParams = [billId];

      switch (transactionData.type) {
        case 'sale':
          updateQuery = `
            UPDATE product_bills 
            SET 
              total_quantity_sold = total_quantity_sold + $2,
              total_amount_due = total_amount_due + $3,
              current_unit_price = $4,
              last_transaction_date = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams.push(transactionData.quantity, transactionData.amount, transactionData.unit_price);
          break;

        case 'payment':
          updateQuery = `
            UPDATE product_bills 
            SET 
              total_amount_paid = total_amount_paid + $2,
              last_transaction_date = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams.push(transactionData.amount);
          break;

        case 'return':
          updateQuery = `
            UPDATE product_bills 
            SET 
              total_quantity_returned = total_quantity_returned + $2,
              total_amount_due = total_amount_due - $3,
              last_transaction_date = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams.push(Math.abs(transactionData.quantity), Math.abs(transactionData.amount));
          break;

        case 'adjustment':
          if (transactionData.amount > 0) {
            updateQuery = `
              UPDATE product_bills 
              SET 
                total_amount_due = total_amount_due + $2,
                last_transaction_date = NOW()
              WHERE id = $1
              RETURNING *
            `;
          } else {
            updateQuery = `
              UPDATE product_bills 
              SET 
                total_amount_paid = total_amount_paid + $2,
                last_transaction_date = NOW()
              WHERE id = $1
              RETURNING *
            `;
          }
          updateParams.push(Math.abs(transactionData.amount));
          break;
      }

      const billResult = await client.query(updateQuery, updateParams);

      await client.query('COMMIT');
      return {
        transaction: transactionResult.rows[0],
        bill: billResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBillsWithDetails(userId, userType, filters = {}) {
    const userColumn = userType === 'retailer' ? 'retailer_id' : 'distributor_id';
    
    let query = `
      SELECT 
        pb.*,
        p.name as product_name,
        p.category as product_category,
        p.icon as product_icon,
        pv.name as variant_name,
        r.business_name as retailer_name,
        r.owner_name as retailer_owner,
        d.company_name as distributor_name,
        d.owner_name as distributor_owner,
        (pb.total_amount_due - pb.total_amount_paid) as outstanding_balance,
        (pb.total_quantity_sold - pb.total_quantity_returned) as net_quantity
      FROM product_bills pb
      JOIN products p ON pb.product_id = p.id
      LEFT JOIN product_variants pv ON pb.variant_id = pv.id
      JOIN retailers r ON pb.retailer_id = r.id
      JOIN distributors d ON pb.distributor_id = d.id
      WHERE pb.${userColumn} = $1
    `;

    const params = [userId];

    if (filters.status) {
      query += ` AND pb.status = ${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.partner_id) {
      const partnerColumn = userType === 'retailer' ? 'distributor_id' : 'retailer_id';
      query += ` AND pb.${partnerColumn} = ${params.length + 1}`;
      params.push(filters.partner_id);
    }

    if (filters.has_outstanding) {
      query += ` AND (pb.total_amount_due - pb.total_amount_paid) > 0`;
    }

    query += ` ORDER BY pb.last_transaction_date DESC`;

    if (filters.limit) {
      query += ` LIMIT ${filters.limit}`;
    }

    if (filters.offset) {
      query += ` OFFSET ${filters.offset}`;
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  async getBillWithTransactions(billId) {
    const query = `
      SELECT 
        pb.*,
        p.name as product_name,
        p.category as product_category,
        pv.name as variant_name,
        r.business_name as retailer_name,
        d.company_name as distributor_name,
        json_agg(
          json_build_object(
            'id', pbt.id,
            'type', pbt.type,
            'quantity', pbt.quantity,
            'unit_price', pbt.unit_price,
            'amount', pbt.amount,
            'note', pbt.note,
            'order_id', pbt.order_id,
            'payment_method', pbt.payment_method,
            'reference_number', pbt.reference_number,
            'transaction_date', pbt.transaction_date,
            'created_by', pbt.created_by,
            'created_by_model', pbt.created_by_model
          ) ORDER BY pbt.transaction_date DESC
        ) as transactions
      FROM product_bills pb
      JOIN products p ON pb.product_id = p.id
      LEFT JOIN product_variants pv ON pb.variant_id = pv.id
      JOIN retailers r ON pb.retailer_id = r.id
      JOIN distributors d ON pb.distributor_id = d.id
      LEFT JOIN product_bill_transactions pbt ON pb.id = pbt.product_bill_id
      WHERE pb.id = $1
      GROUP BY pb.id, p.id, pv.id, r.id, d.id
    `;
    const result = await this.query(query, [billId]);
    return result.rows[0];
  }
}