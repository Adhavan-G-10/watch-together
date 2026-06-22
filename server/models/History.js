const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  videoName: {
    type: String,
    default: "Untitled Video"
  },
  timestamp: {
    type: Number,
    default: 0
  },
  watchedAt: {
    type: Date,
    default: Date.now,
    expires: 604800 // Auto-delete after 7 days (7 * 24 * 60 * 60 seconds)
  }
});

module.exports = mongoose.model('History', HistorySchema);
