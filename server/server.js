const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/room'));
app.use('/api/messages', require('./routes/message'));
app.use('/api/history', require('./routes/history'));
app.use('/api/videos', require('./routes/video'));

// Basic route
app.get('/', (req, res) => {
  res.send('Watch Together API is running');
});

const Message = require('./models/Message');

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userId, username }) => {
    socket.join(roomId);
    console.log(`User ${username} (${userId}) joined room: ${roomId}`);
    
    // Notify others in the room
    socket.to(roomId).emit('user-connected', { userId, username, socketId: socket.id });

    // WebRTC Signaling
    socket.on('sending-signal', payload => {
      io.to(payload.userToSignal).emit('user-joined', { signal: payload.signal, callerID: payload.callerID, username: payload.username });
    });

    socket.on('returning-signal', payload => {
      io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
    });

    // Chat
    socket.on('send-message', async (messageData) => {
      try {
        const newMessage = await Message.create({
          roomId: messageData.roomId,
          sender: userId,
          senderName: username,
          text: messageData.text
        });
        io.to(roomId).emit('receive-message', newMessage);
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });

    // Video Synchronization
    socket.on('video-url-change', (url) => {
      socket.to(roomId).emit('video-url-change', url);
    });

    socket.on('video-play', (time) => {
      socket.to(roomId).emit('video-play', time);
    });

    socket.on('video-pause', (time) => {
      socket.to(roomId).emit('video-pause', time);
    });

    socket.on('video-seek', (time) => {
      socket.to(roomId).emit('video-seek', time);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from room:', socket.id);
      socket.to(roomId).emit('user-disconnected', { userId, username, socketId: socket.id });
    });
  });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/watch_together')
  .then(() => {
    console.log('MongoDB Connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
