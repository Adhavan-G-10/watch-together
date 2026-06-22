import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Video, Users, Plus, LogOut, ArrowRight, History as HistoryIcon, Clock, Link as LinkIcon, Trash2, PlayCircle } from 'lucide-react';

function Home() {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchHistory = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get('/api/history', config);
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleDeleteHistory = async (id, e) => {
    e.stopPropagation();
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`/api/history/${id}`, config);
      fetchHistory(); // Refresh list
    } catch (err) {
      console.error('Failed to delete history', err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all history?")) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete('/api/history/clear', config);
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  const formatTimestamp = (seconds) => {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError('');
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post('/api/rooms/create', { roomId: newRoomId }, config);
      
      navigate(`/room/${newRoomId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    
    try {
      setLoading(true);
      setError('');
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.get(`/api/rooms/${roomId}`, config);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError('Room not found or invalid code');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col items-center">
      <header className="w-full max-w-6xl flex justify-between items-center mb-16 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Video size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-wide">Watch Together</h1>
        </div>
        
        <div className="flex items-center gap-4 bg-dark/50 px-5 py-2 rounded-full border border-white/5 backdrop-blur-sm">
          <span className="text-slate-300 font-medium text-sm">Hi, {user.username}</span>
          <div className="w-px h-4 bg-white/20"></div>
          <button onClick={logout} className="text-slate-400 hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-12 items-start flex-1">
        {/* Left Side: Actions */}
        <div className="lg:col-span-3 space-y-12 animate-[slideIn_0.5s_ease-out] w-full">
          <div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Watch videos <br/>
              <span className="bg-gradient-to-r from-primary to-secondary text-transparent bg-clip-text">together, anywhere.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
              Create a room, invite your friends, video chat, and stream YouTube or your own videos in perfect sync.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
            {/* Create Room Card */}
            <div className="glass-panel p-6 border-primary/20 hover:border-primary/50 transition-colors group cursor-pointer" onClick={handleCreateRoom}>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <Plus size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Create New Room</h3>
              <p className="text-sm text-slate-400">Start a new watch party and invite friends with a code.</p>
            </div>

            {/* Join Room Card */}
            <div className="glass-panel p-6 border-secondary/20 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary mb-4">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Join Room</h3>
              {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Code"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-center tracking-widest font-mono uppercase focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                  maxLength={6}
                  required
                />
                <button type="submit" disabled={loading || !roomId.trim()} className="bg-secondary hover:bg-pink-600 text-white p-2 rounded-lg transition-colors">
                  <ArrowRight size={20} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Side: Watch History */}
        <div className="lg:col-span-2 w-full animate-[fadeIn_0.7s_ease-out]">
          <div className="glass-panel p-6 h-full min-h-[400px] flex flex-col relative overflow-hidden">
            {/* Background glow for glass panel */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-6 z-10">
              <div className="flex items-center gap-2 text-slate-200">
                <HistoryIcon size={20} className="text-primary" />
                <h3 className="text-xl font-bold">Watch History</h3>
              </div>
              {history.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 z-10">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                  <Clock size={40} className="mb-3" />
                  <p className="text-sm">No watch history yet.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item._id} className="bg-white/5 border border-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer group relative" onClick={() => {
                      const query = `?videoUrl=${encodeURIComponent(item.videoUrl)}&t=${item.timestamp || 0}&name=${encodeURIComponent(item.videoName || '')}`;
                      navigate(`/room/${item.roomId}${query}`);
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium px-2 py-1 bg-slate-800 rounded-md text-slate-300 shrink-0">Room: {item.roomId}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2 pr-6">{new Date(item.watchedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-col gap-1 w-full min-w-0 pr-8">
                      <div className="flex items-center gap-2 text-slate-200 font-medium">
                        <PlayCircle size={16} className="text-primary shrink-0" />
                        <span className="truncate flex-1 min-w-0" title={item.videoName}>{item.videoName || 'Untitled Video'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 w-full min-w-0 pl-6">
                        <Clock size={12} className="shrink-0" />
                        <span>Left at {formatTimestamp(item.timestamp)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteHistory(item._id, e)}
                      className="absolute top-3 right-3 p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                      title="Delete from history"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
