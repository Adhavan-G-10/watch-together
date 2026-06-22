const express = require('express');
const router = express.Router();
const History = require('../models/History');

// Middleware to verify token
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

// @route   POST /api/history
// @desc    Add or update a video in history
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { roomId, videoUrl, videoName, timestamp } = req.body;
    
    // Avoid duplicate continuous entries for the same room & video, just update the timestamp
    const lastHistory = await History.findOne({ user: req.user.id }).sort({ watchedAt: -1 });
    if (lastHistory && lastHistory.videoUrl === videoUrl && lastHistory.roomId === roomId) {
      if (timestamp !== undefined) lastHistory.timestamp = timestamp;
      lastHistory.watchedAt = Date.now(); // update time
      if (videoName) lastHistory.videoName = videoName;
      await lastHistory.save();
      return res.status(200).json(lastHistory);
    }

    const history = await History.create({
      user: req.user.id,
      roomId,
      videoUrl,
      videoName: videoName || "Untitled Video",
      timestamp: timestamp || 0
    });

    res.status(201).json(history);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/history
// @desc    Get user's watch history
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const history = await History.find({ user: req.user.id }).sort({ watchedAt: -1 }).limit(20);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/history/clear
// @desc    Clear all history for user
// @access  Private
router.delete('/clear', protect, async (req, res) => {
  try {
    await History.deleteMany({ user: req.user.id });
    res.json({ message: 'All history cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

// @route   DELETE /api/history/:id
// @desc    Delete a specific history record
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const history = await History.findById(req.params.id);
    if (!history) {
      return res.status(404).json({ message: 'History not found' });
    }
    
    // Check if history belongs to user
    if (history.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    await history.deleteOne();
    res.json({ message: 'History removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
