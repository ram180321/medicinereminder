const express = require('express');
const router = express.Router();
const User = require('../models/user'); // Path to your User model
const authMiddleware = require('../middleware/auth'); // Your authentication middleware

// @route   PUT /api/profile
// @desc    Update user profile information (e.g., mobile number)
// @access  Private
router.put('/', authMiddleware, async (req, res) => {
    const { phoneNumber } = req.body;

    // Optional: Basic validation for mobile number
    if (!phoneNumber || phoneNumber.length < 10) {
        return res.status(400).json({ message: 'A valid mobile number is required.' });
    }

    try {
        // Find the user by their ID, which is stored in req.user from the auth middleware
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update the mobileNumber and save the user
        user.phoneNumber = phoneNumber;
        await user.save();

        res.status(200).json({ message: 'Profile updated successfully!', phoneNumber: user.phoneNumber });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error. Failed to update profile.' });
    }
});

// @route   GET /api/profile
// @desc    Get user's own profile data
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('email role phoneNumber');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error. Failed to fetch profile.' });
    }
});

module.exports = router;