import { models } from '../models/index.js';
export const sendConnectionRequest = async (req, res) => {
  try {
    const { distributorId, message } = req.body;
    const retailerId = req.user.id;

    // Check if distributor exists
    const distributor = await models.Distributor.findById(distributorId);
    if (!distributor) {
      return res.status(404).json({ message: 'Distributor not found' });
    }

    // Check if connection already exists
    const existingConnection = await models.ConnectionRequest.findOne({
      retailer_id: retailerId,
      distributor_id: distributorId
    });

    if (existingConnection) {
      return res.status(400).json({ 
        message: 'Connection request already exists',
        status: existingConnection.status
      });
    }

    // Check if already connected
    const connectedDistributors = await models.Retailer.getConnectedDistributors(retailerId);
    const isAlreadyConnected = connectedDistributors.some(d => d.id === distributorId);
    
    if (isAlreadyConnected) {
      return res.status(400).json({ message: 'Already connected to this distributor' });
    }

    const connectionRequest = await models.ConnectionRequest.createRequest({
      retailer_id: retailerId,
      distributor_id: distributorId,
      requested_by: 'retailer',
      message: message || ''
    });

    res.status(201).json({
      message: 'Connection request sent successfully',
      connectionRequest
    });
  } catch (error) {
    console.error('Error sending connection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getDistributorRequests = async (req, res) => {
  try {
    const distributorId = req.user.id;
    const { status } = req.query;

    const requests = await models.ConnectionRequest.getRequestsWithDetails(
      distributorId, 
      'distributor', 
      status
    );

    res.json({
      message: 'Connection requests retrieved successfully',
      requests
    });
  } catch (error) {
    console.error('Error getting distributor requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getRetailerRequests = async (req, res) => {
  try {
    const retailerId = req.user.id;
    const { status } = req.query;

    const requests = await models.ConnectionRequest.getRequestsWithDetails(
      retailerId, 
      'retailer', 
      status
    );

    res.json({
      message: 'Connection requests retrieved successfully',
      requests
    });
  } catch (error) {
    console.error('Error getting retailer requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const respondToConnectionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, rejectionReason } = req.body;
    const distributorId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use "approve" or "reject"' });
    }

    const connectionRequest = await models.ConnectionRequest.findOne({
      id: requestId,
      distributor_id: distributorId,
      status: 'pending'
    });

    if (!connectionRequest) {
      return res.status(404).json({ message: 'Connection request not found or already processed' });
    }

    if (action === 'approve') {
      // Update connection request status
      await models.ConnectionRequest.respond(requestId, 'approve');

      // Add to connections table
      await models.Retailer.addDistributorConnection(connectionRequest.retailer_id, distributorId);

      res.json({
        message: 'Connection request approved successfully',
        connectionRequest
      });
    } else {
      // Reject the request
      await models.ConnectionRequest.respond(requestId, 'reject', rejectionReason);

      res.json({
        message: 'Connection request rejected',
        connectionRequest
      });
    }
  } catch (error) {
    console.error('Error responding to connection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getConnectedDistributors = async (req, res) => {
  try {
    const retailerId = req.user.id;
    const distributors = await models.Retailer.getConnectedDistributors(retailerId);

    res.json({
      message: 'Connected distributors retrieved successfully',
      distributors: distributors
    });
  } catch (error) {
    console.error('Error getting connected distributors:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getConnectedRetailers = async (req, res) => {
  try {
    const distributorId = req.user.id;
    const retailers = await models.Distributor.getConnectedRetailers(distributorId);

    res.json({
      message: 'Connected retailers retrieved successfully',
      retailers: retailers
    });
  } catch (error) {
    console.error('Error getting connected retailers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getSuggestedDistributors = async (req, res) => {
  try {
    const { pincode, businessType } = req.query;
    const retailerId = req.user.id;

    if (!pincode && !businessType) {
      return res.json({ distributors: [] });
    }

    // Get connected distributors to exclude them
    const connectedDistributors = await models.Retailer.getConnectedDistributors(retailerId);
    const connectedIds = connectedDistributors.map(d => d.id);

    // Build query conditions
    let query = 'SELECT * FROM distributors WHERE id NOT IN (';
    const params = [];
    let paramIndex = 1;

    if (connectedIds.length > 0) {
      const placeholders = connectedIds.map(() => `${paramIndex++}`).join(', ');
      query += placeholders + ')';
      params.push(...connectedIds);
    } else {
      query += 'NULL)';
    }

    // Add pincode or business type filter
    if (pincode && businessType) {
      query += ` AND (pincode = ${paramIndex++} OR business_type = ${paramIndex++})`;
      params.push(pincode, businessType);
    } else if (pincode) {
      query += ` AND pincode = ${paramIndex++}`;
      params.push(pincode);
    } else if (businessType) {
      query += ` AND business_type = ${paramIndex++}`;
      params.push(businessType);
    }

    const result = await models.Distributor.query(query, params);
    
    // Get connection request statuses
    const distributorIds = result.rows.map(d => d.id);
    const requests = await models.ConnectionRequest.find({
      retailer_id: retailerId,
      distributor_id: { $in: distributorIds }
    });

    const requestMap = {};
    requests.forEach(r => {
      requestMap[r.distributor_id] = r.status;
    });

    const distributorsWithStatus = result.rows.map(d => ({
      ...d,
      requestStatus: requestMap[d.id] || null
    }));

    // Sort: those with no requestStatus first
    distributorsWithStatus.sort((a, b) => {
      if (!a.requestStatus && b.requestStatus) return -1;
      if (a.requestStatus && !b.requestStatus) return 1;
      return 0;
    });

    res.json({ distributors: distributorsWithStatus });
  } catch (error) {
    console.error('Error getting suggested distributors:', error);
    res.status(500).json({ message: "Server error" });
  }
};

export const searchDistributors = async (req, res) => {
  try {
    const { location, businessType, companyName, pincode } = req.query;
    const retailerId = req.user.id;

    // Get connected distributors to exclude them
    const connectedDistributors = await models.Retailer.getConnectedDistributors(retailerId);
    const connectedIds = connectedDistributors.map(d => d.id);

    let query = 'SELECT * FROM distributors WHERE id NOT IN (';
    const params = [];
    let paramIndex = 1;

    if (connectedIds.length > 0) {
      const placeholders = connectedIds.map(() => `${paramIndex++}`).join(', ');
      query += placeholders + ')';
      params.push(...connectedIds);
    } else {
      query += 'NULL)';
    }

    // Add search conditions
    const searchConditions = [];
    if (location) {
      searchConditions.push(`location ILIKE ${paramIndex++}`);
      params.push(`%${location}%`);
    }
    if (businessType) {
      searchConditions.push(`business_type ILIKE ${paramIndex++}`);
      params.push(`%${businessType}%`);
    }
    if (companyName) {
      searchConditions.push(`company_name ILIKE ${paramIndex++}`);
      params.push(`%${companyName}%`);
    }
    if (pincode) {
      searchConditions.push(`pincode = ${paramIndex++}`);
      params.push(pincode);
    }

    if (searchConditions.length > 0) {
      query += ` AND (${searchConditions.join(' OR ')})`;
    }

    query += ' LIMIT 20';

    const result = await models.Distributor.query(query, params);

    res.json({
      message: 'Distributors found',
      distributors: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching distributors:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const removeConnection = async (req, res) => {
  try {
    const { distributorId } = req.params;
    const retailerId = req.user.id;

    // Remove connection
    await models.Retailer.removeDistributorConnection(retailerId, distributorId);

    // Update connection request status if exists
    const existingRequest = await models.ConnectionRequest.findOne({
      retailer_id: retailerId,
      distributor_id: distributorId
    });

    if (existingRequest) {
      await models.ConnectionRequest.respond(existingRequest.id, 'reject', 'Connection removed by retailer');
    }

    res.json({
      message: 'Connection removed successfully'
    });
  } catch (error) {
    console.error('Error removing connection:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getSuggestedRetailers = async (req, res) => {
  try {
    const distributorId = req.user.id;
    const distributor = await models.Distributor.findById(distributorId);
    
    if (!distributor) {
      return res.status(404).json({ message: 'Distributor not found' });
    }

    // Get connected retailers to exclude them
    const connectedRetailers = await models.Distributor.getConnectedRetailers(distributorId);
    const connectedIds = connectedRetailers.map(r => r.id);

    // Build query to find retailers with same pincode or businessType, not already connected
    let query = 'SELECT * FROM retailers WHERE id NOT IN (';
    const params = [];
    let paramIndex = 1;

    if (connectedIds.length > 0) {
      const placeholders = connectedIds.map(() => `$${paramIndex++}`).join(', ');
      query += placeholders + ')';
      params.push(...connectedIds);
    } else {
      query += 'NULL)';
    }

    // Add pincode or business type filter
    query += ` AND (pincode = $${paramIndex++} OR business_type = $${paramIndex++})`;
    params.push(distributor.pincode, distributor.business_type);
    
    query += ' LIMIT 20';

    const result = await models.Retailer.query(query, params);

    res.json({ 
      retailers: result.rows 
    });
  } catch (error) {
    console.error('Error getting suggested retailers:', error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Search retailers by location/business type
// @route   GET /api/connections/search/retailers
// @access  Private (Distributor)
export const searchRetailers = async (req, res) => {
  try {
    const { location, businessType, businessName, pincode } = req.query;
    const distributorId = req.user.id;

    // Get connected retailers to exclude them
    const connectedRetailers = await models.Distributor.getConnectedRetailers(distributorId);
    const connectedIds = connectedRetailers.map(r => r.id);

    let query = 'SELECT * FROM retailers WHERE id NOT IN (';
    const params = [];
    let paramIndex = 1;

    if (connectedIds.length > 0) {
      const placeholders = connectedIds.map(() => `$${paramIndex++}`).join(', ');
      query += placeholders + ')';
      params.push(...connectedIds);
    } else {
      query += 'NULL)';
    }

    // Add search conditions
    const searchConditions = [];
    if (location) {
      searchConditions.push(`location ILIKE $${paramIndex++}`);
      params.push(`%${location}%`);
    }
    if (businessType) {
      searchConditions.push(`business_type ILIKE $${paramIndex++}`);
      params.push(`%${businessType}%`);
    }
    if (businessName) {
      searchConditions.push(`business_name ILIKE $${paramIndex++}`);
      params.push(`%${businessName}%`);
    }
    if (pincode) {
      searchConditions.push(`pincode = $${paramIndex++}`);
      params.push(pincode);
    }

    if (searchConditions.length > 0) {
      query += ` AND (${searchConditions.join(' OR ')})`;
    } else {
      // If no search conditions, return empty result
      return res.json({
        message: 'No search criteria provided',
        retailers: [],
        count: 0
      });
    }

    query += ' LIMIT 20';

    const result = await models.Retailer.query(query, params);

    res.json({
      message: 'Retailers found',
      retailers: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching retailers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};