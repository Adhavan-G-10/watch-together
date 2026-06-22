const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// Middleware to verify token (Simple version for this file)
const jwt = require('jsonwebtoken');
const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
      req.user = { id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// @route   POST /api/rooms/create
// @desc    Create a new room
// @access  Private
router.post('/create', protect, async (req, res) => {
  try {
    const { roomId } = req.body;
    
    // Check if room already exists
    const roomExists = await Room.findOne({ roomId });
    if (roomExists) {
      return res.status(400).json({ message: 'Room code already exists. Try another one.' });
    }

    const room = await Room.create({
      roomId,
      host: req.user.id,
      participants: [req.user.id]
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/rooms/:roomId
// @desc    Get room by ID / Check if valid
// @access  Private
router.get('/:roomId', protect, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (room) {
      // If user is not in participants, maybe add them? (Handled via socket usually, but let's just return room info)
      res.json(room);
    } else {
      res.status(404).json({ message: 'Room not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
