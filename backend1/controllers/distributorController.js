import { models } from '../models/index.js';
import generateToken from '../utils/generateToken.js';
export const registerDistributor = async (req, res) => {
  console.log('📩 Register Distributor Endpoint Hit');
  console.log('Request Body:', req.body);

  const {
    companyName, ownerName, phone, email, password,
    gstNumber, location, businessType, pincode, address
  } = req.body;

  try {
    const distributorExists = await models.Distributor.findByEmail(email);
    if (distributorExists) {
      return res.status(400).json({ message: 'Distributor already exists' });
    }

    const distributor = await models.Distributor.create({
      company_name: companyName,
      owner_name: ownerName,
      email,
      password,
      phone,
      gst_number: gstNumber,
      business_type: businessType,
      pincode,
      location,
      address,
      distributorships: [businessType]
    });

    if (distributor) {
      res.status(201).json({
        _id: distributor.id,
        ownerName: distributor.owner_name,
        companyName: distributor.company_name,
        gstNumber: distributor.gst_number,
        phone: distributor.phone,
        email: distributor.email,
        businessType: distributor.business_type,
        pincode: distributor.pincode,
        location: distributor.location,
        address: distributor.address,
        role: 'distributor',
        token: generateToken(distributor.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid distributor data' });
    }
  } catch (error) {
    console.error('❌ Error in registration:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const loginDistributor = async (req, res) => {
  const { email, password } = req.body;

  try {
    const distributor = await models.Distributor.findByEmail(email);

    if (distributor && (await models.Distributor.matchPassword(distributor.id, password))) {
      res.json({
        _id: distributor.id,
        ownerName: distributor.owner_name,
        companyName: distributor.company_name,
        phone: distributor.phone,
        role: "distributor",
        gstNumber: distributor.gst_number,
        email: distributor.email,
        token: generateToken(distributor.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getDistributorProfile = async (req, res) => {
  try {
    const distributor = await models.Distributor.findById(req.user.id);

    if (distributor) {
      // Get connected retailers
      const retailers = await models.Distributor.getConnectedRetailers(distributor.id);
      
      res.json({
        _id: distributor.id,
        ownerName: distributor.owner_name,
        companyName: distributor.company_name,
        phone: distributor.phone,
        email: distributor.email,
        role: 'distributor',
        gstNumber: distributor.gst_number,
        businessType: distributor.business_type,
        pincode: distributor.pincode,
        location: distributor.location,
        address: distributor.address,
        retailers: retailers,
      });
    } else {
      res.status(404).json({ message: 'Distributor not found' });
    }
  } catch (error) {
    console.error('❌ Get Profile error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getDistributorByIds = async (req, res) => {
  const { ids } = req.body;

  try {
    const distributors = await models.Distributor.find({ id: { $in: ids } });

    const formattedDistributors = distributors.map(d => ({
      _id: d.id,
      companyName: d.company_name,
      ownerName: d.owner_name,
      phone: d.phone,
      email: d.email,
      gstNumber: d.gst_number,
      businessType: d.business_type,
      pincode: d.pincode,
      location: d.location,
      address: d.address
    }));

    res.json({ distributors: formattedDistributors });
  } catch (error) {
    console.error('❌ Error fetching distributors by IDs:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};
