import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Trophy, Calendar, Users, CreditCard, Zap, 
  CheckCircle2, BarChart3, ShieldCheck, LogOut, UserCheck, 
  Shuffle, ChevronRight, Check, X, Flame, Lock, Phone, User as UserIcon, Key,
  RefreshCw, Database, AlertCircle, Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area 
} from 'recharts';

// --- TYPES & INTERFACES ---
type UserRole = 'SUPER_ADMIN' | 'MEMBER' | 'PLAYER';
type SkillGrade = 'S (Pro)' | 'A (Advanced)' | 'B (Upper Inter)' | 'C (Intermediate)' | 'D (Beginner)';

interface User {
  id: string;
  playerId: string; // Unique running player login key e.g. "SH-1001"
  name: string;
  whatsapp: string;
  role: UserRole;
  grade: SkillGrade;
  elo: number;
  avatar: string;
  membershipStatus: 'Active' | 'Pending' | 'Expired';
  duesOwed: number;
  matchesPlayed: number;
  wins: number;
}

interface Court {
  id: number;
  name: string;
  courtCode: string; // e.g. "CRT-01", "CRT-02"
  status: 'Available' | 'Occupied' | 'Maintenance';
  currentMatchId?: string;
}

interface Booking {
  id: string;
  courtId: number;
  courtName: string;
  courtCode: string;
  playerName: string;
  playerId: string;
  date: string;
  timeSlot: string;
  type: 'Casual Play' | 'Tournament' | 'Training Session';
  paymentStatus: 'Paid' | 'Unpaid';
  fee: number;
}

interface Match {
  id: string;
  courtId: number;
  team1: string[];
  team2: string[];
  score1: number[];
  score2: number[];
  currentSet: number;
  status: 'Scheduled' | 'Live' | 'Completed';
  serverTeam: 1 | 2;
  winner?: 1 | 2;
  startTime: string;
}

interface Invoice {
  id: string;
  playerName: string;
  playerId: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  paymentMethod?: string;
}

// Secret Code required to register as Super Admin
const SECRET_ADMIN_CODE = 'SMASH2026ADMIN';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'grading' | 'billing'>('dashboard');
  
  // App Dynamic State
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Realtime Connection & Loading State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Syncing' | 'Offline' | 'Empty'>('Syncing');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  // Auth Dialog state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [loginPlayerId, setLoginPlayerId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration fields
  const [regFullName, setRegFullName] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regAdminCode, setRegAdminCode] = useState('');
  const [regRole, setRegRole] = useState<'MEMBER' | 'PLAYER'>('PLAYER');

  // Registration Success Modal
  const [newlyRegisteredId, setNewlyRegisteredId] = useState<string | null>(null);

  // Topmost Layer Toast Notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 6000);
  };

  // --- REALTIME D1 DATABASE FETCH ENGINE ---
  const fetchD1Data = useCallback(async (silent = false) => {
    if (!silent) setDbStatus('Syncing');
    try {
      const [uRes, cRes, bRes, mRes, iRes] = await Promise.allSettled([
        fetch('/api/users').then(res => res.ok ? res.json() : Promise.reject(res)),
        fetch('/api/courts').then(res => res.ok ? res.json() : Promise.reject(res)),
        fetch('/api/bookings').then(res => res.ok ? res.json() : Promise.reject(res)),
        fetch('/api/matches').then(res => res.ok ? res.json() : Promise.reject(res)),
        fetch('/api/invoices').then(res => res.ok ? res.json() : Promise.reject(res)),
      ]);

      let fetchedUsers: User[] = [];
      let fetchedCourts: Court[] = [];
      let fetchedBookings: Booking[] = [];
      let fetchedMatches: Match[] = [];
      let fetchedInvoices: Invoice[] = [];

      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value)) fetchedUsers = uRes.value;
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value)) fetchedCourts = cRes.value;
      if (bRes.status === 'fulfilled' && Array.isArray(bRes.value)) fetchedBookings = bRes.value;
      if (mRes.status === 'fulfilled' && Array.isArray(mRes.value)) fetchedMatches = mRes.value;
      if (iRes.status === 'fulfilled' && Array.isArray(iRes.value)) fetchedInvoices = iRes.value;

      setUsers(fetchedUsers);
      setCourts(fetchedCourts);
      setBookings(fetchedBookings);
      setMatches(fetchedMatches);
      setInvoices(fetchedInvoices);

      setLastSyncedAt(new Date().toLocaleTimeString());
      setDbStatus(fetchedUsers.length === 0 && fetchedCourts.length === 0 ? 'Empty' : 'Connected');
    } catch (error) {
      console.warn('Cloudflare D1 query error:', error);
      setDbStatus('Offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll Cloudflare D1 database every 10 seconds
  useEffect(() => {
    fetchD1Data();
    const interval = setInterval(() => fetchD1Data(true), 10000);
    return () => clearInterval(interval);
  }, [fetchD1Data]);

  // Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginPlayerId.trim().toUpperCase();

    const foundUser = users.find(u => u.playerId.toUpperCase() === cleanId);

    if (foundUser) {
      setCurrentUser(foundUser);
      setIsAuthOpen(false);
      setLoginPlayerId('');
      setLoginPassword('');
      showToast(`Welcome back, ${foundUser.name}! Signed in as ${foundUser.role} (${foundUser.playerId}).`, 'success');
    } else {
      showToast('⚠️ Player ID not found! Please check your ID or Register a new account.', 'error');
    }
  };

  // Registration Handler with D1 Storage & Resilient Fallback
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFullName.trim() || !regWhatsapp.trim()) {
      showToast('⚠️ Please fill in all required fields!', 'error');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      showToast('⚠️ Passwords do not match! Please re-verify.', 'error');
      return;
    }

    if (regPassword.length < 4) {
      showToast('⚠️ Password must be at least 4 characters long.', 'error');
      return;
    }

    let assignedRole: UserRole = regRole;
    if (regAdminCode.trim()) {
      if (regAdminCode.trim() === SECRET_ADMIN_CODE) {
        assignedRole = 'SUPER_ADMIN';
      } else {
        showToast('⚠️ Invalid Secret Admin Code! Assigned standard account role.', 'error');
        return;
      }
    }

    const nextSeq = 1000 + users.length + 1;
    const generatedPlayerId = `SH-${nextSeq}`;

    const newUserPayload = {
      id: `u-${Date.now()}`,
      playerId: generatedPlayerId,
      name: regFullName.trim(),
      whatsapp: regWhatsapp.trim(),
      password: regPassword,
      role: assignedRole,
      grade: 'D (Beginner)' as SkillGrade,
      elo: 1200,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
      membershipStatus: 'Active' as const,
      duesOwed: 0,
      matchesPlayed: 0,
      wins: 0
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserPayload)
      });

      if (!res.ok) {
        if (res.status === 405) {
          throw new Error('HTTP 405: Please upload src/worker.js to GitHub as detailed in the guide!');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      showToast(`🎉 Registration successful! Account ${generatedPlayerId} written to Cloudflare D1!`, 'success');
    } catch (err: any) {
      console.warn('D1 direct write fallback warning:', err);
      showToast(`⚠️ Cloudflare D1 write notice: ${err.message}. Account initialized locally.`, 'info');
    }

    const newUser: User = {
      id: newUserPayload.id,
      playerId: newUserPayload.playerId,
      name: newUserPayload.name,
      whatsapp: newUserPayload.whatsapp,
      role: newUserPayload.role,
      grade: newUserPayload.grade,
      elo: newUserPayload.elo,
      avatar: newUserPayload.avatar,
      membershipStatus: newUserPayload.membershipStatus,
      duesOwed: newUserPayload.duesOwed,
      matchesPlayed: newUserPayload.matchesPlayed,
      wins: newUserPayload.wins
    };

    setUsers(prev => [newUser, ...prev]);
    setCurrentUser(newUser);
    setIsAuthOpen(false);
    setNewlyRegisteredId(generatedPlayerId);

    setRegFullName('');
    setRegWhatsapp('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegAdminCode('');
  };

  const handleQuickLogin = (playerId: string) => {
    const user = users.find(u => u.playerId === playerId);
    if (user) {
      setCurrentUser(user);
      setIsAuthOpen(false);
      showToast(`Signed in as ${user.role} (${user.name} - ${user.playerId})`, 'info');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    showToast('Signed out successfully. Switched to Guest mode.', 'info');
  };

  const canAccessTab = (tabId: string) => {
    if (currentUser) return true;
    return tabId === 'dashboard' || tabId === 'booking';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      
      {/* --- TOP NAVIGATION BAR --- */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/30">
                <Zap className="w-6 h-6 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                  SmashHub<span className="text-emerald-400">.pro</span>
                </span>
                <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Cloudflare D1 Platform</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { id: 'booking', label: 'Courts & Schedule', icon: Calendar },
                { id: 'matchmaker', label: 'Matchmaker', icon: Shuffle },
                { id: 'scoring', label: 'Live Scoring', icon: Activity },
                { id: 'grading', label: 'Player Grading', icon: Trophy },
                { id: 'billing', label: 'Billing & Dues', icon: CreditCard },
              ].map(tab => {
                const isAllowed = canAccessTab(tab.id);
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                if (!isAllowed) return null;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-slate-800 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Profile / Controls */}
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => fetchD1Data()} 
                title={`Cloudflare D1 Database Status: ${dbStatus}. Click to refresh.`}
                className="hidden lg:flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full text-[11px] font-mono hover:border-slate-700 transition"
              >
                <Database className={`w-3.5 h-3.5 ${
                  dbStatus === 'Connected' ? 'text-emerald-400' :
                  dbStatus === 'Syncing' ? 'text-amber-400 animate-spin' :
                  dbStatus === 'Empty' ? 'text-cyan-400' : 'text-rose-400'
                }`} />
                <span className="text-slate-300">D1:</span>
                <span className={
                  dbStatus === 'Connected' ? 'text-emerald-400 font-semibold' :
                  dbStatus === 'Syncing' ? 'text-amber-400 font-semibold' :
                  dbStatus === 'Empty' ? 'text-cyan-400 font-semibold' : 'text-rose-400 font-semibold'
                }>
                  {dbStatus}
                </span>
              </button>

              {currentUser ? (
                <div className="flex items-center space-x-3 bg-slate-800/80 p-1.5 pl-3 rounded-full border border-slate-700/60">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-slate-200 leading-tight">{currentUser.name}</p>
                    <p className="text-[10px] text-emerald-400 font-mono">{currentUser.role} • {currentUser.playerId}</p>
                  </div>
                  <img src={currentUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full ring-2 ring-emerald-500/50 object-cover" />
                  <button 
                    onClick={handleLogout} 
                    title="Sign Out" 
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-full hover:bg-slate-700/50 transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { setAuthMode('login'); setIsAuthOpen(true); }}
                    className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-emerald-500/20"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* --- TOPMOST FLOATING TOAST NOTIFICATION LAYER (z-[9999]) --- */}
      {toastMessage && (
        <div className="fixed top-5 right-5 sm:top-8 sm:right-8 z-[9999] max-w-md w-full pointer-events-auto">
          <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-2xl border-2 flex items-start space-x-3 transition-all animate-bounce ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/80'
              : toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/80'
              : 'bg-slate-900/95 border-cyan-500 text-slate-100 shadow-slate-950/80'
          }`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            ) : toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Zap className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 pr-2">
              <h4 className="text-xs uppercase font-extrabold tracking-wider opacity-80 mb-0.5">
                {toastMessage.type === 'error' ? 'System Notice' : toastMessage.type === 'success' ? 'Operation Completed' : 'Notification'}
              </h4>
              <p className="text-xs font-semibold leading-relaxed">{toastMessage.text}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <p className="text-sm font-mono text-slate-400">Connecting to Cloudflare D1 Realtime Database...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView 
                users={users} 
                courts={courts} 
                matches={matches} 
                invoices={invoices}
                currentUser={currentUser}
                setActiveTab={setActiveTab}
                setIsAuthOpen={setIsAuthOpen}
                fetchD1Data={fetchD1Data}
              />
            )}
            {activeTab === 'booking' && (
              <BookingView 
                courts={courts} 
                bookings={bookings} 
                setBookings={setBookings} 
                currentUser={currentUser} 
                showToast={showToast}
                setIsAuthOpen={setIsAuthOpen}
                fetchD1Data={fetchD1Data}
              />
            )}
            {activeTab === 'matchmaker' && currentUser && (
              <MatchMakerView 
                users={users} 
                courts={courts} 
                matches={matches} 
                setMatches={setMatches}
                setCourts={setCourts}
                showToast={showToast}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'scoring' && currentUser && (
              <ScoringView 
                matches={matches} 
                setMatches={setMatches} 
                courts={courts}
                setCourts={setCourts}
                users={users}
                setUsers={setUsers}
                showToast={showToast}
              />
            )}
            {activeTab === 'grading' && currentUser && (
              <GradingView 
                users={users} 
                setUsers={setUsers}
                currentUser={currentUser}
                showToast={showToast}
              />
            )}
            {activeTab === 'billing' && currentUser && (
              <BillingView 
                invoices={invoices} 
                setInvoices={setInvoices} 
                showToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* --- TOPMOST AUTH MODAL LAYER (z-[9999]) --- */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pointer-events-auto">
          <div className="bg-slate-900 border-2 border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto ring-4 ring-slate-900/50">
            <button 
              onClick={() => setIsAuthOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {authMode === 'login' ? 'Sign In with Player ID' : 'Register New Player Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {authMode === 'login' 
                  ? 'Enter your allocated unique Player ID and password' 
                  : 'Create a new account profile'}
              </p>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unique Player ID</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SH-1001"
                    value={loginPlayerId}
                    onChange={e => setLoginPlayerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg shadow-emerald-500/20 transition"
                >
                  Authenticate & Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Player Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kevin Sanjaya"
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Phone Number *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+6281234567890"
                    value={regWhatsapp}
                    onChange={e => setRegWhatsapp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Role</label>
                  <select
                    value={regRole}
                    onChange={e => setRegRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PLAYER">Player (Standard Access)</option>
                    <option value="MEMBER">Member (Priority Reservation)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Secret Admin Code (Super Admin Only)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter SMASH2026ADMIN for Super Admin"
                    value={regAdminCode}
                    onChange={e => setRegAdminCode(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-900/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg shadow-emerald-500/20 transition mt-2"
                >
                  Register Account & Save Profile
                </button>
              </form>
            )}

            <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
              {authMode === 'login' ? (
                <span>Need a player account? <button onClick={() => setAuthMode('register')} className="text-emerald-400 font-semibold underline">Register Here</button></span>
              ) : (
                <span>Already have a Player ID? <button onClick={() => setAuthMode('login')} className="text-emerald-400 font-semibold underline">Sign In Here</button></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TOPMOST REGISTERED ID CONFIRMATION MODAL LAYER (z-[9999]) --- */}
      {newlyRegisteredId && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl ring-4 ring-emerald-500/20">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Account Ready!</h3>
            <p className="text-xs text-slate-400">Save your allocated unique Player ID for all future logins:</p>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 text-2xl font-black font-mono text-emerald-400 tracking-wider">
              {newlyRegisteredId}
            </div>

            <button
              onClick={() => setNewlyRegisteredId(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
            >
              Got It & Continue
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponents (DashboardView, BookingView, MatchMakerView, ScoringView, GradingView, BillingView)
function DashboardView({ users, courts, matches, invoices, currentUser, setActiveTab, setIsAuthOpen, fetchD1Data }: any) {
  const activeCourts = courts.filter((c: any) => c.status === 'Occupied').length;
  const pendingDuesTotal = invoices.filter((i: any) => i.status === 'Pending').reduce((acc: number, curr: any) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs text-emerald-400 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Real-Time Cloudflare D1 Backend</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2">
              Badminton Operations & Analytics
            </h1>
          </div>
          <button onClick={() => fetchD1Data()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync D1</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Active Courts</p>
          <h3 className="text-2xl font-bold text-white mt-1">{activeCourts} / {courts.length || 0}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Registered Players</p>
          <h3 className="text-2xl font-bold text-white mt-1">{users.length}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Live Matches</p>
          <h3 className="text-2xl font-bold text-cyan-400 mt-1">{matches.filter((m: any)=>m.status==='Live').length}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Pending Dues</p>
          <h3 className="text-2xl font-bold text-amber-400 mt-1">${pendingDuesTotal}</h3>
        </div>
      </div>
    </div>
  );
}

function BookingView({ courts, bookings, setBookings, currentUser, showToast, setIsAuthOpen, fetchD1Data }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Courts & Reservations</h2>
      <p className="text-xs text-slate-400">Total bookings in database: {bookings.length}</p>
    </div>
  );
}

function MatchMakerView({ users, courts, matches, setMatches, setCourts, showToast, setActiveTab }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">AI ELO Matchmaker</h2>
      <p className="text-xs text-slate-400">Active player pool: {users.length} players</p>
    </div>
  );
}

function ScoringView({ matches, setMatches, courts, setCourts, users, setUsers, showToast }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Live BWF Scorekeeper</h2>
      <p className="text-xs text-slate-400">Matches available: {matches.length}</p>
    </div>
  );
}

function GradingView({ users, setUsers, currentUser, showToast }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Player Skill Standings</h2>
      <p className="text-xs text-slate-400">Total rated members: {users.length}</p>
    </div>
  );
}

function BillingView({ invoices, setInvoices, showToast }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Billing & Invoices</h2>
      <p className="text-xs text-slate-400">Total invoice records: {invoices.length}</p>
    </div>
  );
}
