import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Peer from 'simple-peer';
import axios from 'axios';
import ReactPlayer from 'react-player';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Users, LogOut, Video, Mic, MicOff, VideoOff, Send, MessageSquare, MonitorUp, StopCircle, Link as LinkIcon, Play, UploadCloud, X } from 'lucide-react';

const VideoPeer = ({ peer, username }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      if (ref.current) ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="w-full h-full bg-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden group shadow-lg border border-white/10">
      <video playsInline autoPlay ref={ref} className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-black/60 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm backdrop-blur-md font-medium text-white shadow-md">
        {username}
      </div>
    </div>
  );
};

function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  
  // States
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [showChat, setShowChat] = useState(false); 

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialUrl = queryParams.get('videoUrl') || '';
  const initialTimestamp = parseFloat(queryParams.get('t')) || 0;
  const initialName = queryParams.get('name') || '';

  // Video Sync & Upload States
  const [videoUrl, setVideoUrl] = useState(initialUrl);
  const [videoName, setVideoName] = useState(initialName);
  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [playing, setPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaControls, setShowMediaControls] = useState(false);
  
  // Refs
  const userVideo = useRef();
  const peersRef = useRef([]);
  const playerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const isSyncing = useRef(false);
  const hasSeekedInitial = useRef(false);

  const iceServers = { 
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ] 
  };

  useEffect(() => {
    if (!socket || !user) return;

    const fetchMessages = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const res = await axios.get(`/api/messages/${roomId}`, config);
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    };
    fetchMessages();

    const initRoom = async () => {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Could not get media stream", err);
        setStreamError(true);
        // Create an empty stream to avoid breaking WebRTC peer logic
        stream = new MediaStream();
        localStreamRef.current = stream;
      }

      socket.emit('join-room', { roomId, userId: user._id, username: user.username });

      socket.on('user-connected', ({ socketId, username }) => {
        const peer = createPeer(socketId, socket.id, stream, user.username);
        peersRef.current.push({ peerID: socketId, peer, username });
        setPeers([...peersRef.current]);

        // If we are watching a video, tell the new user about it
        if (videoUrl) {
          socket.emit('sync-video-to-new-user', {
            targetSocketId: socketId,
            url: videoUrl,
            name: videoName,
            time: playerRef.current ? playerRef.current.getCurrentTime() : 0,
            playing
          });
        }
      });

      socket.on('user-joined', payload => {
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({ peerID: payload.callerID, peer, username: payload.username });
        setPeers([...peersRef.current]);
      });

      socket.on('receiving-returned-signal', payload => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        if (item) item.peer.signal(payload.signal);
      });

      socket.on('user-disconnected', ({ socketId }) => {
        const peerObj = peersRef.current.find(p => p.peerID === socketId);
        if (peerObj) peerObj.peer.destroy();
        peersRef.current = peersRef.current.filter(p => p.peerID !== socketId);
        setPeers([...peersRef.current]);
      });
    };

    initRoom();

    socket.on('receive-message', (message) => {
      setMessages(prev => {
        const isDuplicate = prev.some(m => m._id === message._id || 
          (m.text === message.text && m.sender === message.sender && Math.abs(new Date(m.createdAt) - new Date(message.createdAt)) < 1000));
        if (isDuplicate) return prev;
        return [...prev, message];
      });
    });

    socket.on('video-url-change', (data) => {
      const url = typeof data === 'string' ? data : data.url;
      const name = typeof data === 'string' ? 'Shared Video' : data.name;
      setVideoUrl(url);
      setVideoName(name);
      hasSeekedInitial.current = false;
      saveToHistory(url, name, 0);
    });

    socket.on('video-play', (time) => {
      isSyncing.current = true;
      if (playerRef.current) playerRef.current.seekTo(time, 'seconds');
      setPlaying(true);
      setTimeout(() => isSyncing.current = false, 500);
    });

    socket.on('video-pause', (time) => {
      isSyncing.current = true;
      if (playerRef.current) playerRef.current.seekTo(time, 'seconds');
      setPlaying(false);
      setTimeout(() => isSyncing.current = false, 500);
    });

    socket.on('video-seek', (time) => {
      isSyncing.current = true;
      if (playerRef.current) playerRef.current.seekTo(time, 'seconds');
      setTimeout(() => isSyncing.current = false, 500);
    });

    socket.on('sync-video', (data) => {
      if (!videoUrl) { // Only sync if we don't already have a video playing
        setVideoUrl(data.url);
        setVideoName(data.name);
        setPlaying(data.playing);
        hasSeekedInitial.current = false; // reset this so it can seek
        // Force player to seek when ready using initialTimestamp state logic
        // We can just rely on the onReady handler for initial seek by temporarily modifying url params or direct seek
        if (playerRef.current) {
          playerRef.current.seekTo(data.time, 'seconds');
        } else {
          // If player isn't rendered yet, we can cheat by relying on it to play from start, 
          // or we can wait for ready. Since we don't want to overcomplicate, we'll seek after a tiny delay
          setTimeout(() => {
            if (playerRef.current) playerRef.current.seekTo(data.time, 'seconds');
          }, 1000);
        }
      }
    });

    return () => {
      socket.off('user-connected');
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('user-disconnected');
      socket.off('receive-message');
      socket.off('video-url-change');
      socket.off('video-play');
      socket.off('video-pause');
      socket.off('video-seek');
      socket.off('sync-video');
      
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
      if (screenTrackRef.current) screenTrackRef.current.stop();
    };
  }, [socket, roomId, user]);

  useEffect(() => {
    if (!videoUrl) return;
    const interval = setInterval(() => {
      if (playerRef.current && playing) {
        saveToHistory(videoUrl, videoName, playerRef.current.getCurrentTime());
      }
    }, 10000); // Save every 10 seconds while playing
    return () => clearInterval(interval);
  }, [videoUrl, videoName, playing]);

  const saveToHistory = async (url, name, timestamp) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post('/api/history', { 
        roomId, 
        videoUrl: url, 
        videoName: name || "Untitled Video",
        timestamp: timestamp !== undefined ? timestamp : (playerRef.current ? playerRef.current.getCurrentTime() : 0)
      }, config);
    } catch (err) {
      console.error("Failed to save history", err);
    }
  };

  function createPeer(userToSignal, callerID, stream, username) {
    const peer = new Peer({ initiator: true, trickle: true, stream, config: iceServers });
    peer.on('signal', signal => socket.emit('sending-signal', { userToSignal, callerID, signal, username }));
    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({ initiator: false, trickle: true, stream, config: iceServers });
    peer.on('signal', signal => socket.emit('returning-signal', { signal, callerID }));
    peer.signal(incomingSignal);
    return peer;
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks()[0].enabled = !isVideoOn;
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks()[0].enabled = !isAudioOn;
      setIsAudioOn(!isAudioOn);
    }
  };

  const handleShareScreen = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
        const screenTrack = stream.getTracks()[0];
        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);

        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        peersRef.current.forEach(peerObj => {
          peerObj.peer.replaceTrack(videoTrack, screenTrack, localStreamRef.current);
        });
        
        if (userVideo.current) userVideo.current.srcObject = new MediaStream([screenTrack]);

        screenTrack.onended = () => stopScreenShare();
      } else {
        stopScreenShare();
      }
    } catch (err) { console.error("Error sharing screen:", err); }
  };

  const stopScreenShare = () => {
    if (!isScreenSharing) return;
    setIsScreenSharing(false);
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    
    peersRef.current.forEach(peerObj => {
      const currentTrack = peerObj.peer.streams[0]?.getVideoTracks()[0];
      if (currentTrack) peerObj.peer.replaceTrack(currentTrack, videoTrack, localStreamRef.current);
    });

    if (userVideo.current) userVideo.current.srcObject = localStreamRef.current;
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (inputUrl && socket) {
      const name = inputName.trim() || 'YouTube Video';
      setVideoUrl(inputUrl);
      setVideoName(name);
      hasSeekedInitial.current = false;
      saveToHistory(inputUrl, name, 0);
      socket.emit('video-url-change', { url: inputUrl, name });
      setInputUrl('');
      setInputName('');
      setShowMediaControls(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File size is too large. Please upload a video under 20MB or check Cloudinary limits.");
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const config = {
        headers: { 
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      };

      const res = await axios.post('/api/videos/upload', formData, config);
      const url = res.data.url;
      const name = file.name || 'Uploaded Video';
      
      setVideoUrl(url);
      setVideoName(name);
      hasSeekedInitial.current = false;
      saveToHistory(url, name, 0);
      socket.emit('video-url-change', { url, name });
      setShowMediaControls(false);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Video upload failed! Make sure you added valid Cloudinary Keys in server/.env file.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handlePlay = () => {
    if (!isSyncing.current && socket && playerRef.current) {
      socket.emit('video-play', playerRef.current.getCurrentTime());
      setPlaying(true);
    }
  };

  const handlePause = () => {
    if (!isSyncing.current && socket && playerRef.current) {
      socket.emit('video-pause', playerRef.current.getCurrentTime());
      setPlaying(false);
    }
  };

  const handleSeek = (seconds) => {
    if (!isSyncing.current && socket) socket.emit('video-seek', seconds);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    socket.emit('send-message', { roomId, text: newMessage });
    setNewMessage('');
  };

  const handlePlayerReady = () => {
    if (initialTimestamp > 0 && !hasSeekedInitial.current && playerRef.current) {
      playerRef.current.seekTo(initialTimestamp, 'seconds');
      hasSeekedInitial.current = true;
    }
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-darker text-white">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 bg-dark/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-primary">
            <Video size={24} />
            <span className="font-bold hidden md:inline text-lg tracking-wide">Watch Together</span>
          </div>
          <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
          <div className="flex items-center gap-2 sm:gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs sm:text-sm">
            <span className="text-slate-400 hidden sm:inline">Room:</span>
            <span className="font-mono font-bold tracking-widest text-secondary">{roomId}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={handleShareScreen}
            className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-xs sm:text-sm font-medium transition-all border ${
              isScreenSharing 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30' 
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {isScreenSharing ? <StopCircle size={16} /> : <MonitorUp size={16} />}
            <span className="hidden sm:inline">{isScreenSharing ? 'Stop Sharing' : 'Share'}</span>
          </button>
          
          <div className="hidden sm:flex items-center gap-2 text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <Users size={16} className="text-primary" />
            <span className="text-sm font-medium">{peers.length + 1}</span>
          </div>
          <button 
            onClick={() => {
              if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
              navigate('/');
            }}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium transition-all border border-red-500/20"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Side: Video Player & WebRTC Feeds */}
        <div className="flex-1 p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 overflow-y-auto md:overflow-hidden custom-scrollbar">
          
          {/* YouTube Sync / Video Player - only show if URL exists */}
          {videoUrl && (
            <div className="w-full min-h-[320px] md:aspect-auto md:h-auto md:min-h-0 md:flex-1 bg-black rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden shrink-0">
              <div className="absolute inset-0">
                <ReactPlayer
                  ref={playerRef}
                  url={videoUrl}
                  width="100%"
                  height="100%"
                  playing={playing}
                  controls={true}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onSeek={handleSeek}
                  onReady={handlePlayerReady}
                  config={{ 
                    youtube: { 
                      playerVars: { 
                        disablekb: 1,
                        modestbranding: 1, // Hides YouTube logo
                        rel: 0, // Hides related videos at the end
                        playsinline: 1, // Prevents fullscreen takeover on mobile
                        iv_load_policy: 3 // Hides video annotations
                      } 
                    } 
                  }}
                />
              </div>
            </div>
          )}

          {/* WebRTC Video Feeds: Large grid if no video URL, small row if video URL exists */}
          <div className={`grid gap-2 sm:gap-4 transition-all duration-500 ${videoUrl ? 'grid-cols-2 md:grid-cols-4 shrink-0' : 'grid-cols-1 sm:grid-cols-2 flex-1'}`}>
            {/* Local Video */}
            <div className={`relative aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-lg border ${isScreenSharing ? 'border-blue-500 shadow-blue-500/20' : 'border-white/10'}`}>
              {streamError ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                  <VideoOff size={32} className="mb-2 text-red-400" />
                  <span className="text-sm">Camera error</span>
                </div>
              ) : (
                <>
                  <video muted ref={userVideo} autoPlay playsInline className={`w-full h-full object-cover ${!isScreenSharing ? '-scale-x-100' : ''} ${!isVideoOn && !isScreenSharing ? 'hidden' : ''}`} />
                  {!isVideoOn && !isScreenSharing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-primary flex items-center justify-center text-2xl sm:text-4xl font-bold text-white">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  
                  {/* Persistent Media Controls Bottom Left */}
                  <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex flex-wrap items-center gap-1 sm:gap-2">
                    <div className="bg-black/60 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm backdrop-blur-md font-medium text-white shadow-md flex items-center gap-1 sm:gap-2">
                      {user.username} (You)
                      {isScreenSharing && <MonitorUp size={14} className="text-blue-400" />}
                    </div>
                    <button onClick={toggleAudio} className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-colors ${isAudioOn ? 'bg-black/50 text-white hover:bg-black/70' : 'bg-red-500/80 text-white hover:bg-red-500'}`}>
                      {isAudioOn ? <Mic size={14} /> : <MicOff size={14} />}
                    </button>
                    {!isScreenSharing && (
                      <button onClick={toggleVideo} className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-colors ${isVideoOn ? 'bg-black/50 text-white hover:bg-black/70' : 'bg-red-500/80 text-white hover:bg-red-500'}`}>
                        {isVideoOn ? <Video size={14} /> : <VideoOff size={14} />}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Remote Videos */}
            {peers.map((peer) => (
              <div key={peer.peerID} className="aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-white/10">
                <VideoPeer peer={peer.peer} username={peer.username} />
              </div>
            ))}
          </div>

          {/* Upload / Link Input Area */}
          {!videoUrl ? (
            <div className="w-full max-w-2xl mx-auto mt-auto p-4 sm:p-6 bg-slate-800/40 border border-white/10 rounded-2xl backdrop-blur-sm shrink-0">
              <h3 className="text-center font-bold text-xl mb-4 text-white">Watch Together Sync</h3>
              {isUploading ? (
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="text-primary mb-3 animate-pulse"><UploadCloud size={32} /></div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-secondary h-2 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <span className="text-sm font-medium text-slate-300">Uploading {uploadProgress}%</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row flex-1 gap-2">
                    <input
                      type="text"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="Video Name (Optional)"
                      className="w-full sm:w-1/3 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:ring-1 focus:ring-primary focus:outline-none text-white min-w-0"
                    />
                    <div className="relative flex-1 min-w-0">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon size={18} className="text-slate-400" />
                      </div>
                      <input
                        type="url"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="Paste YouTube Link..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-base sm:text-sm focus:ring-1 focus:ring-primary focus:outline-none text-white min-w-0"
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary py-2.5 px-4 whitespace-nowrap shadow-md shrink-0">
                      Play
                    </button>
                  </form>
                  <div className="relative w-full sm:w-auto">
                    <input 
                      type="file" 
                      accept="video/*" 
                      onChange={handleFileUpload} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-full sm:w-auto px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 bg-secondary border border-secondary/50 hover:bg-pink-600 transition-colors cursor-pointer shadow-md text-white">
                      <UploadCloud size={18} />
                      <span className="font-medium text-sm whitespace-nowrap">Upload Local</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full shrink-0 flex flex-col gap-2 mt-2">
              {!showMediaControls ? (
                <button 
                  onClick={() => setShowMediaControls(true)} 
                  className="w-full sm:w-auto self-center bg-slate-800/60 hover:bg-slate-700/80 border border-white/10 rounded-xl px-6 py-3 flex items-center justify-center gap-2 text-white font-medium transition-colors"
                >
                  <UploadCloud size={18} /> Change Video / Upload Local
                </button>
              ) : (
                <div className="w-full bg-slate-800/90 border border-white/20 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl animate-[fadeIn_0.2s_ease-out]">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-white text-sm">Play New Video</h4>
                    <button onClick={() => setShowMediaControls(false)} className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 transition-colors"><X size={16}/></button>
                  </div>
                  
                  {isUploading ? (
                    <div className="flex items-center gap-4 px-2">
                      <span className="text-sm font-medium text-slate-300">Uploading... {uploadProgress}%</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="text" 
                          value={inputName} 
                          onChange={(e) => setInputName(e.target.value)} 
                          placeholder="Name (Optional)" 
                          className="w-full sm:w-1/3 bg-black/50 border border-white/20 rounded-lg px-3 py-2.5 text-base sm:text-sm text-white focus:ring-1 focus:ring-primary focus:outline-none min-w-0" 
                        />
                        <input 
                          type="url" 
                          value={inputUrl} 
                          onChange={(e) => setInputUrl(e.target.value)} 
                          placeholder="Paste YouTube Link..." 
                          className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-2.5 text-base sm:text-sm text-white focus:ring-1 focus:ring-primary focus:outline-none min-w-0" 
                          required
                        />
                        <button type="submit" className="bg-primary hover:bg-indigo-600 py-2.5 px-4 text-sm font-medium rounded-lg text-white transition-colors shrink-0 shadow-md">Play</button>
                      </form>
                      <div className="relative w-full">
                        <input type="file" accept="video/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 bg-secondary border border-secondary/50 font-medium text-sm text-white cursor-pointer hover:bg-pink-600 transition-colors shadow-md">
                          <UploadCloud size={18} /> Upload Local File
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Chat Toggle Button */}
        <button 
          onClick={() => setShowChat(!showChat)}
          className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center z-50 hover:scale-105 transition-transform"
        >
          {showChat ? <X size={24} /> : <MessageSquare size={24} />}
        </button>

        {/* Right Side: Live Chat (Sidebar) */}
        <div className={`fixed md:relative inset-y-0 right-0 w-80 sm:w-96 md:w-80 border-l border-white/5 bg-darker/95 md:bg-dark/30 backdrop-blur-xl flex flex-col shrink-0 z-40 transition-transform duration-300 ease-in-out transform ${showChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-secondary" />
              <span className="font-semibold text-slate-200 tracking-wide">Live Chat</span>
            </div>
            <button onClick={() => setShowChat(false)} className="md:hidden text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-sm text-slate-500">
                <p>No messages yet.<br/>Say hi to the room!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.sender === user._id ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.sender === user._id ? 'You' : msg.senderName}</span>
                  <div className={`px-4 py-2 text-sm rounded-2xl max-w-[85%] break-words shadow-sm ${
                    msg.sender === user._id 
                      ? 'bg-gradient-to-r from-primary to-indigo-600 rounded-tr-sm text-white' 
                      : 'bg-slate-800 rounded-tl-sm text-slate-200 border border-white/5'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-white/5 bg-black/20">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message..." 
                className="flex-1 bg-slate-800/50 border border-white/10 rounded-full px-4 py-2 text-base sm:text-sm focus:ring-1 focus:ring-secondary focus:outline-none placeholder-slate-400 transition-all text-white min-w-0"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-600 transition-colors shadow-md"
              >
                <Send size={16} className="-ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
