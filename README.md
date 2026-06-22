# 🎬 Watch Together

![Watch Together UI](https://img.shields.io/badge/MERN-Stack-blue?style=for-the-badge&logo=mongodb)
![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-black?style=for-the-badge&logo=socket.io)
![WebRTC](https://img.shields.io/badge/WebRTC-Video%20Chat-green?style=for-the-badge&logo=webrtc)

**Watch Together** is a full-stack, real-time synchronized video-sharing and communication platform. Built with the MERN stack, Socket.io, and WebRTC, it allows users to join private rooms, video chat, message each other, and watch YouTube or local videos in perfect sync.

## ✨ Features

- 🎥 **Perfect Synchronization:** Play, pause, and seek videos. Any action taken by one user is instantly synced to everyone in the room.
- 📺 **YouTube & Local Videos:** Paste any YouTube link to watch together, or directly upload your own local video files.
- 🗣️ **Video & Audio Calls:** Built-in WebRTC peer-to-peer video chatting. Includes mute/unmute and camera toggle controls.
- 💬 **Live Text Chat:** Real-time messaging sidebar within the watch room.
- 🖥️ **Screen Sharing:** Share your screen with friends seamlessly instead of your camera.
- 🕒 **Smart Watch History:** Your watched videos are saved with exact timestamps. Click any past video to resume exactly where you left off. (Auto-clears after 7 days).
- 🎨 **Premium UI/UX:** A stunning, modern dark-mode aesthetic featuring glassmorphism, mesh gradients, and fully responsive design for Desktop, Tablet, and Mobile.

## 🛠️ Tech Stack

**Frontend:**
- React 18 (Vite)
- Tailwind CSS (Custom AMOLED Dark Theme)
- Socket.io-client
- Simple-Peer (WebRTC)
- React-Player & React-Router-Dom

**Backend:**
- Node.js & Express
- Socket.io (Real-time events)
- MongoDB & Mongoose
- JSON Web Tokens (JWT) for Authentication
- Cloudinary (For local video uploads)

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js and MongoDB installed on your system. You will also need a Cloudinary account for video uploads.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/watch-together.git
cd watch-together
```

### 2. Setup the Backend
```bash
cd server
npm install
```

Create a `.env` file in the `server` directory and add your credentials:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Start the backend server:
```bash
npm run dev
```

### 3. Setup the Frontend
Open a new terminal and navigate to the frontend directory:
```bash
cd client
npm install
```

Start the React development server:
```bash
npm run dev
```

## 🎮 How to Use
1. **Register/Login** to your account.
2. Click **Create New Room** and share the 6-character room code with a friend.
3. Your friend can enter the code in the **Join Room** section.
4. Paste a YouTube link or upload a video.
5. Grab some popcorn and enjoy watching together! 🍿

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📝 License
This project is licensed under the MIT License.
# watch-together
