// controllers/retailerController.js
import { models } from '../models/index.js';
import generateToken from '../utils/generateToken.js';

export const registerRetailer = async (req, res) => {
  console.log('📩 Register Retailer Endpoint Hit');
  console.log('Request Body:', req.body);

  const {
    businessName, ownerName, phone, email, password,
    gstNumber, location, businessType, pincode
  } = req.body;

  try {
    const retailerExists = await models.Retailer.findByEmail(email);
    if (retailerExists) {
      return res.status(400).json({ message: 'Retailer already exists' });
    }

    const retailer = await models.Retailer.create({
      business_name: businessName,
      owner_name: ownerName,
      email,
      password,
      phone,
      gst_number: gstNumber,
      business_type: businessType,
      pincode,
      location,
    });

    if (retailer) {
      res.status(201).json({
        _id: retailer.id,
        ownerName: retailer.owner_name,
        businessName: retailer.business_name,
        gstNumber: retailer.gst_number,
        phone: retailer.phone,
        email: retailer.email,
        businessType: retailer.business_type,
        pincode: retailer.pincode,
        location: retailer.location,
        role: 'retailer',
        token: generateToken(retailer.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid retailer data' });
    }
  } catch (error) {
    console.error('❌ Error in registration:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const loginRetailer = async (req, res) => {
  const { email, password } = req.body;

  try {
    const retailer = await models.Retailer.findByEmail(email);

    if (retailer && (await models.Retailer.matchPassword(retailer.id, password))) {
      res.json({
        _id: retailer.id,
        ownerName: retailer.owner_name,
        businessName: retailer.business_name,
        phone: retailer.phone,
        email: retailer.email,
        role: 'retailer',
        pincode: retailer.pincode,
        location: retailer.location,
        gstNumber: retailer.gst_number,
        businessType: retailer.business_type,
        token: generateToken(retailer.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getRetailerProfile = async (req, res) => {
  try {
    const retailer = await models.Retailer.findById(req.user.id);

    if (retailer) {
      res.json({
        _id: retailer.id,
        ownerName: retailer.owner_name,
        businessName: retailer.business_name,
        phone: retailer.phone,
        email: retailer.email,
        role: 'retailer',
        gstNumber: retailer.gst_number,
        businessType: retailer.business_type,
        pincode: retailer.pincode,
        location: retailer.location,
      });
    } else {
      res.status(404).json({ message: 'Retailer not found' });
    }
  } catch (error) {
    console.error('❌ Get Profile error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

