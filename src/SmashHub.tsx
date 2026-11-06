//v0.2.5

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Trophy, Calendar, Users, CreditCard, Zap, 
  CheckCircle2, BarChart3, ShieldCheck, LogOut, UserCheck, 
  Shuffle, ChevronRight, Check, X, Flame, Lock, Phone, User as UserIcon, Key,
  Database, RefreshCw, AlertCircle, Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area 
} from 'recharts';

// --- TYPES & INTERFACES ---
type UserRole = 'SUPER_ADMIN' | 'MEMBER' | 'PLAYER';
type SkillGrade = 'S (Pro)' | 'A (Advanced)' | 'B (Upper Inter)' | 'C (Intermediate)' | 'D (Beginner)';

interface User {
  id: string;
  playerId: string; // Unique running player login key e.g. "AD-1001", "MB-1001", "SH-1001"
  player_id?: string; // D1 SQLite column fallback
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
  type: 'Synthetic Wooden' | 'Standard Mat';
  status: 'Available' | 'Occupied' | 'Maintenance';
  currentMatchId?: string;
  lighting: 'LED Pro 500 Lux' | 'Standard 300 Lux';
}

interface Booking {
  id: string;
  courtId: number;
  courtName: string;
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

interface ToastNotice {
  text: string;
  type: 'success' | 'error' | 'info';
}

// Secret Code required to register as Super Admin
const SECRET_ADMIN_CODE = 'SMASH2026ADMIN';

// Recharts Data
const OCCUPANCY_DATA = [
  { hour: '14:00', occupancy: 30 },
  { hour: '15:00', occupancy: 45 },
  { hour: '16:00', occupancy: 60 },
  { hour: '17:00', occupancy: 85 },
  { hour: '18:00', occupancy: 100 },
  { hour: '19:00', occupancy: 95 },
  { hour: '20:00', occupancy: 80 },
  { hour: '21:00', occupancy: 50 },
];

const REVENUE_DATA = [
  { day: 'Mon', revenue: 420 },
  { day: 'Tue', revenue: 380 },
  { day: 'Wed', revenue: 510 },
  { day: 'Thu', revenue: 490 },
  { day: 'Fri', revenue: 780 },
  { day: 'Sat', revenue: 950 },
  { day: 'Sun', revenue: 890 },
];

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'grading' | 'billing' | 'users'>('dashboard');
  
  // App Dynamic State
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Realtime Connection & Loading State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Syncing' | 'Offline' | 'Empty'>('Syncing');
  const [, setLastSyncedAt] = useState<string>('');

  // Auth Dialog state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login fields (accepts either Unique Code OR Name)
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration fields
  const [regFullName, setRegFullName] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regAdminCode, setRegAdminCode] = useState('');
  const [regRole, setRegRole] = useState<'MEMBER' | 'PLAYER'>('PLAYER');

  // Registration Success Popup State
  const [newlyRegisteredId, setNewlyRegisteredId] = useState<string | null>(null);

  // Floating Topmost Toast Notification State
  const [toastMessage, setToastMessage] = useState<ToastNotice | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('smashhub_session_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.warn('Could not restore local user session', e);
    }
  }, []);

  // Save session to localStorage when currentUser updates
  const setSessionUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('smashhub_session_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('smashhub_session_user');
    }
  };

  // --- REALTIME DATABASE FETCH ENGINE ---
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

      if (uRes.status === 'fulfilled' && Array.isArray(uRes.value)) {
        fetchedUsers = uRes.value.map((u: any) => ({
          ...u,
          playerId: u.playerId || u.player_id || u.id
        }));
      }
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
      console.warn('DB query error:', error);
      setDbStatus('Offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll database every 10 seconds
  useEffect(() => {
    fetchD1Data();
    const interval = setInterval(() => fetchD1Data(true), 10000);
    return () => clearInterval(interval);
  }, [fetchD1Data]);

  // Login Handler (Supports Unique Code OR Full Name)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginInput.trim().toUpperCase();

    const foundUser = users.find(u => {
      const pId = (u.playerId || u.player_id || '').toUpperCase();
      const uName = (u.name || '').toUpperCase();
      return pId === cleanInput || uName === cleanInput;
    });

    if (foundUser) {
      setSessionUser(foundUser);
      setIsAuthOpen(false);
      setLoginInput('');
      setLoginPassword('');
      showToast(`Welcome back, ${foundUser.name}! Signed in as ${foundUser.role} (${foundUser.playerId}).`, 'success');
    } else {
      showToast('⚠️ Account not found! Type your full registered Name or Unique ID (e.g. AD-1001 / SH-1001).', 'error');
    }
  };

  // Helper to generate prefix based on role
  const getRolePrefix = (role: UserRole) => {
    if (role === 'SUPER_ADMIN') return 'AD';
    if (role === 'MEMBER') return 'MB';
    return 'SH';
  };

  // Registration Handler
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
        showToast('⚠️ Invalid Secret Admin Code! Registration aborted.', 'error');
        return;
      }
    }

    const prefix = getRolePrefix(assignedRole);
    const sameRoleCount = users.filter(u => u.role === assignedRole).length;
    const nextSeq = 1001 + sameRoleCount;
    const generatedPlayerId = `${prefix}-${nextSeq}`;

    const newUserPayload = {
      id: `u-${Date.now()}`,
      playerId: generatedPlayerId,
      player_id: generatedPlayerId,
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
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      showToast(`🎉 Account ${generatedPlayerId} created & saved to database!`, 'success');
    } catch (err: any) {
      console.warn('Database write notice:', err);
      showToast(`⚠️ Database Sync Notice: ${err.message}. Initialized in local session.`, 'info');
    }

    const newUser: User = {
      id: newUserPayload.id,
      playerId: newUserPayload.playerId,
      player_id: newUserPayload.player_id,
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
    setSessionUser(newUser);
    setIsAuthOpen(false);
    setNewlyRegisteredId(generatedPlayerId);

    setRegFullName('');
    setRegWhatsapp('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegAdminCode('');
  };

  const handleLogout = () => {
    setSessionUser(null);
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
                <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold">BioDev</span>
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
                { id: 'users', label: 'User Management', icon: Users },
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
                title={`Database Status: ${dbStatus}. Click to sync.`}
                className="hidden lg:flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full text-[11px] font-mono hover:border-slate-700 transition"
              >
                <Database className={`w-3.5 h-3.5 ${
                  dbStatus === 'Connected' ? 'text-emerald-400' :
                  dbStatus === 'Syncing' ? 'text-amber-400 animate-spin' :
                  dbStatus === 'Empty' ? 'text-cyan-400' : 'text-rose-400'
                }`} />
                <span className="text-slate-300">DB Connection:</span>
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

      {/* --- TOPMOST SLOW-BOUNCING FLOATING TOAST NOTIFICATION LAYER (z-[99999]) --- */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[99999] max-w-md w-full pointer-events-auto">
          <div 
            style={{ animationDuration: '3s' }}
            className={`p-4 rounded-2xl shadow-2xl backdrop-blur-2xl border-2 flex items-start space-x-3 transition-all animate-bounce ${
              toastMessage.type === 'error'
                ? 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/90'
                : toastMessage.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/90'
                : 'bg-slate-900/95 border-cyan-500 text-slate-100 shadow-slate-950/90'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            ) : toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Zap className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 pr-2">
              <h4 className="text-xs uppercase font-extrabold tracking-wider opacity-80 mb-0.5">
                {toastMessage.type === 'error' ? 'System Alert' : toastMessage.type === 'success' ? 'Success' : 'Notice'}
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
            <p className="text-sm font-mono text-slate-400">Connecting to Realtime Database...</p>
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
            {activeTab === 'users' && currentUser && (
              <UserManagementView
                users={users}
                setUsers={setUsers}
                currentUser={currentUser}
                showToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* --- TOPMOST AUTH MODAL LAYER (z-[99999]) --- */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pointer-events-auto">
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
                {authMode === 'login' ? 'Sign In to SmashHub' : 'Register New Player Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {authMode === 'login' 
                  ? 'Sign in using your Unique ID (AD-1001 / MB-1001 / SH-1001) OR your Full Name' 
                  : 'Create a new account profile'}
              </p>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unique ID or Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AD-1001, SH-1001 or Alex Vance"
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                    <option value="PLAYER">Player (Code Prefix: SH-)</option>
                    <option value="MEMBER">Member (Code Prefix: MB-)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Secret Admin Code (Super Admin Only: AD-)</span>
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
                <span>Already registered? <button onClick={() => setAuthMode('login')} className="text-emerald-400 font-semibold underline">Sign In Here</button></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TOPMOST REGISTERED ID CONFIRMATION MODAL LAYER (z-[99999]) --- */}
      {newlyRegisteredId && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl ring-4 ring-emerald-500/20">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Account Ready!</h3>
            <p className="text-xs text-slate-400">Save your allocated unique Player ID or use your name to log in:</p>
            
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

// --- DASHBOARD VIEW ---
function DashboardView({ users, courts, matches, invoices, setActiveTab, setIsAuthOpen, fetchD1Data }: any) {
  const activeCourts = courts.filter((c: any) => c.status === 'Occupied').length;
  const pendingDuesTotal = invoices.filter((i: any) => i.status === 'Pending').reduce((acc: number, curr: any) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs text-emerald-400 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Real-Time Operational Manager</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2">
              Badminton Operations & Analytics
            </h1>
          </div>
          <button onClick={() => fetchD1Data()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync</span>
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

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Court Occupancy Trend</h3>
              <p className="text-xs text-slate-400">Average court utilization by hour</p>
            </div>
            <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">Peak 18:00 - 20:00</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={OCCUPANCY_DATA}>
                <defs>
                  <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="occupancy" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOcc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Weekly Revenue Stream</h3>
              <p className="text-xs text-slate-400">Court fees & membership collection</p>
            </div>
            <span className="text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-1 rounded">Total $4,420</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_DATA}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="revenue" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- BOOKING VIEW ---
function BookingView({ 
  courts, bookings, setBookings, currentUser, showToast, setIsAuthOpen 
}: { 
  courts: Court[]; bookings: Booking[]; setBookings: React.Dispatch<React.SetStateAction<Booking[]>>; currentUser: User | null; showToast: (msg: string, type?: any) => void; setIsAuthOpen: (open: boolean) => void; 
}) {
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(courts[0] || null);
  const [bookingDate, setBookingDate] = useState('2026-11-06');
  const [selectedSlot, setSelectedSlot] = useState('18:00 - 19:00');
  const [bookingType, setBookingType] = useState<'Casual Play' | 'Tournament' | 'Training Session'>('Casual Play');

  const timeSlots = [
    '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', 
    '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00',
    '18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00'
  ];

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('⚠️ Please sign in to make court reservations!', 'error');
      setIsAuthOpen(true);
      return;
    }
    if (!selectedCourt) return;

    const isConflict = bookings.some(b => 
      b.courtId === selectedCourt.id && b.date === bookingDate && b.timeSlot === selectedSlot
    );

    if (isConflict) {
      showToast('⚠️ Time slot already booked! Please select another time.', 'error');
      return;
    }

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      playerName: currentUser.name,
      playerId: currentUser.playerId || currentUser.player_id || '',
      date: bookingDate,
      timeSlot: selectedSlot,
      type: bookingType,
      paymentStatus: 'Paid',
      fee: selectedCourt.type === 'Synthetic Wooden' ? 35 : 25
    };

    setBookings([newBooking, ...bookings]);
    showToast(`✅ Reserved ${selectedCourt.name} for ${bookingDate} [${selectedSlot}]`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>Court Schedule & Reservation Console</span>
          </h2>
          <p className="text-xs text-slate-400">View real-time court availability and reserve sessions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Available Badminton Courts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courts.map(court => {
              const isSelected = selectedCourt?.id === court.id;
              return (
                <div 
                  key={court.id}
                  onClick={() => setSelectedCourt(court)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{court.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{court.type}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      court.status === 'Available' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      court.status === 'Occupied' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                      'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      {court.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 mt-6">
            <h3 className="text-sm font-bold text-white">Upcoming Club Reservations</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Court</th>
                    <th className="p-3">Reserved By</th>
                    <th className="p-3">Player ID</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Session Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200">{b.courtName}</td>
                      <td className="p-3">{b.playerName}</td>
                      <td className="p-3 font-mono text-emerald-400 font-semibold">{b.playerId}</td>
                      <td className="p-3 font-mono">{b.date} • {b.timeSlot}</td>
                      <td className="p-3">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                          {b.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Court Session Booking</h3>
            <p className="text-xs text-slate-400">Selected: <span className="text-emerald-400 font-medium">{selectedCourt?.name || 'None'}</span></p>
          </div>

          {!currentUser ? (
            <div className="bg-slate-950 p-5 rounded-xl border border-amber-500/30 text-center space-y-3">
              <Lock className="w-6 h-6 text-amber-400 mx-auto" />
              <h4 className="text-xs font-bold text-amber-300 uppercase">Login Required To Book</h4>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-lg text-xs shadow-md transition"
              >
                Sign In / Register Now
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Date</label>
                <input 
                  type="date" 
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Time Slot</label>
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map(slot => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-1.5 px-2 text-xs rounded-lg font-mono text-center transition ${
                        selectedSlot === slot ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-950 border border-slate-800 text-slate-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Activity Category</label>
                <select
                  value={bookingType}
                  onChange={e => setBookingType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Casual Play">Casual Play</option>
                  <option value="Tournament">Tournament Match</option>
                  <option value="Training Session">Personal Training</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Reservation</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// --- MATCHMAKER VIEW ---
function MatchMakerView({ users, courts, matches, setMatches, setCourts, showToast, setActiveTab }: any) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(users.map((u: any) => u.id));
  const [matchFormat, setMatchFormat] = useState<'Doubles' | 'Singles'>('Doubles');
  const [targetCourtId, setTargetCourtId] = useState<number>(1);

  const togglePlayerSelect = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter(pid => pid !== id));
    } else {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleGeneratePairings = () => {
    const activePlayers = users.filter((u: any) => selectedPlayerIds.includes(u.id));

    if (matchFormat === 'Doubles' && activePlayers.length < 4) {
      showToast('⚠️ Need at least 4 players selected for Doubles matchmaking!', 'error');
      return;
    }
    if (matchFormat === 'Singles' && activePlayers.length < 2) {
      showToast('⚠️ Need at least 2 players selected for Singles matchmaking!', 'error');
      return;
    }

    const sorted = [...activePlayers].sort((a, b) => b.elo - a.elo);

    let t1: string[] = [];
    let t2: string[] = [];

    if (matchFormat === 'Doubles') {
      t1 = [`${sorted[0].name} (${sorted[0].playerId})`, `${sorted[3].name} (${sorted[3].playerId})`];
      t2 = [`${sorted[1].name} (${sorted[1].playerId})`, `${sorted[2].name} (${sorted[2].playerId})`];
    } else {
      t1 = [`${sorted[0].name} (${sorted[0].playerId})`];
      t2 = [`${sorted[1].name} (${sorted[1].playerId})`];
    }

    const newMatch: Match = {
      id: `m-${Date.now().toString().slice(-4)}`,
      courtId: targetCourtId,
      team1: t1,
      team2: t2,
      score1: [0],
      score2: [0],
      currentSet: 1,
      status: 'Live',
      serverTeam: 1,
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMatches([newMatch, ...matches]);
    setCourts(courts.map((c: any) => c.id === targetCourtId ? { ...c, status: 'Occupied', currentMatchId: newMatch.id } : c));

    showToast(`🏸 Balanced ${matchFormat} match generated & dispatched to Court ${targetCourtId}!`, 'success');
    setActiveTab('scoring');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Shuffle className="w-5 h-5 text-cyan-400" />
            <span>AI ELO Matchmaker & Rotation Hub</span>
          </h2>
          <p className="text-xs text-slate-400">Algorithmic player pairing to guarantee competitive parity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Select Active Player Pool ({selectedPlayerIds.length} Selected)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {users.map((player: any) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              return (
                <div
                  key={player.id}
                  onClick={() => togglePlayerSelect(player.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    isSelected ? 'bg-slate-800 border-cyan-500/60' : 'bg-slate-950 border-slate-800/80 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img src={player.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <h4 className="text-xs font-bold text-white">{player.name} <span className="text-[10px] text-cyan-400 font-mono">({player.playerId || player.player_id})</span></h4>
                      <p className="text-[10px] text-slate-400">{player.grade} • {player.elo} ELO</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
          <h3 className="font-bold text-white text-base">Match Config</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMatchFormat('Doubles')}
                className={`py-2 text-xs rounded-xl font-bold border ${matchFormat === 'Doubles' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400'}`}
              >
                Doubles (2v2)
              </button>
              <button
                type="button"
                onClick={() => setMatchFormat('Singles')}
                className={`py-2 text-xs rounded-xl font-bold border ${matchFormat === 'Singles' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400'}`}
              >
                Singles (1v1)
              </button>
            </div>

            <button
              onClick={handleGeneratePairings}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Generate & Dispatch Match</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SCORING VIEW ---
function ScoringView({ matches, setMatches, courts, setCourts, users, setUsers, showToast }: any) {
  const liveMatches = matches.filter((m: any) => m.status === 'Live');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(liveMatches[0]?.id || matches[0]?.id);

  const activeMatch = matches.find((m: any) => m.id === selectedMatchId);

  const addPoint = (team: 1 | 2) => {
    if (!activeMatch || activeMatch.status === 'Completed') return;

    const currentSetIdx = activeMatch.currentSet - 1;
    const scores1 = [...activeMatch.score1];
    const scores2 = [...activeMatch.score2];

    if (team === 1) {
      scores1[currentSetIdx] = (scores1[currentSetIdx] || 0) + 1;
    } else {
      scores2[currentSetIdx] = (scores2[currentSetIdx] || 0) + 1;
    }

    const s1 = scores1[currentSetIdx];
    const s2 = scores2[currentSetIdx];

    let setWinner: 1 | 2 | null = null;
    if ((s1 >= 21 || s2 >= 21) && Math.abs(s1 - s2) >= 2) {
      setWinner = s1 > s2 ? 1 : 2;
    } else if (s1 === 30 || s2 === 30) {
      setWinner = s1 === 30 ? 1 : 2;
    }

    if (setWinner) {
      const setsWon1 = scores1.filter((s, idx) => s > (scores2[idx] || 0) && (s >= 21 || scores2[idx] >= 21)).length;
      const setsWon2 = scores2.filter((s, idx) => s > (scores1[idx] || 0) && (s >= 21 || scores1[idx] >= 21)).length;

      if (setsWon1 === 2 || setsWon2 === 2) {
        const matchWinner = setsWon1 === 2 ? 1 : 2;
        setMatches(matches.map((m: any) => m.id === activeMatch.id ? {
          ...m,
          score1: scores1,
          score2: scores2,
          status: 'Completed',
          winner: matchWinner
        } : m));

        setCourts(courts.map((c: any) => c.id === activeMatch.courtId ? { ...c, status: 'Available', currentMatchId: undefined } : c));

        showToast(`🏆 Match Finalized! Team ${matchWinner} Wins!`, 'success');
        return;
      } else {
        showToast(`Set ${activeMatch.currentSet} won by Team ${setWinner}! Moving to Set ${activeMatch.currentSet + 1}.`, 'info');
        scores1.push(0);
        scores2.push(0);
        setMatches(matches.map((m: any) => m.id === activeMatch.id ? {
          ...m,
          score1: scores1,
          score2: scores2,
          currentSet: m.currentSet + 1,
          serverTeam: setWinner
        } : m));
        return;
      }
    }

    setMatches(matches.map((m: any) => m.id === activeMatch.id ? {
      ...m,
      score1: scores1,
      score2: scores2,
      serverTeam: team
    } : m));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <span>Digital BWF Scoreboard & Referee Console</span>
        </h2>
      </div>

      {activeMatch ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
            <div className="p-6 bg-slate-950 rounded-2xl border border-emerald-500/40">
              <h3 className="text-lg font-bold text-white">{activeMatch.team1.join(' / ')}</h3>
              <div className="text-7xl font-black text-emerald-400 my-4">
                {activeMatch.score1[activeMatch.currentSet - 1] ?? 0}
              </div>
              <button onClick={() => addPoint(1)} className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl">
                +1 POINT (TEAM 1)
              </button>
            </div>

            <div className="p-6 bg-slate-950 rounded-2xl border border-cyan-500/40">
              <h3 className="text-lg font-bold text-white">{activeMatch.team2.join(' / ')}</h3>
              <div className="text-7xl font-black text-cyan-400 my-4">
                {activeMatch.score2[activeMatch.currentSet - 1] ?? 0}
              </div>
              <button onClick={() => addPoint(2)} className="w-full bg-cyan-500 text-slate-950 font-bold py-3 rounded-xl">
                +1 POINT (TEAM 2)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">No active matches found. Use Matchmaker to create a game.</div>
      )}
    </div>
  );
}

// --- GRADING VIEW ---
function GradingView({ users, setUsers, currentUser, showToast }: any) {
  const [selectedUser, setSelectedUser] = useState<User>(users[0]);
  const [newGrade, setNewGrade] = useState<SkillGrade>(selectedUser?.grade || 'D (Beginner)');
  const [newElo, setNewElo] = useState<number>(selectedUser?.elo || 1200);

  const handleUpdateGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'SUPER_ADMIN') {
      showToast('⚠️ Only Super Admins can modify official player skill grades!', 'error');
      return;
    }

    setUsers(users.map((u: any) => u.id === selectedUser.id ? { ...u, grade: newGrade, elo: newElo } : u));
    showToast(`Grading updated for ${selectedUser.name} (${selectedUser.playerId}) -> ${newGrade} (${newElo} ELO)`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span>Player Skill Tier & ELO Standings</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">ID</th>
                  <th className="p-3">Grade</th>
                  <th className="p-3">ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((player: any) => (
                  <tr key={player.id} onClick={() => setSelectedUser(player)} className="hover:bg-slate-800 cursor-pointer">
                    <td className="p-3 font-bold text-white">{player.name}</td>
                    <td className="p-3 font-mono text-emerald-400">{player.playerId || player.player_id}</td>
                    <td className="p-3">{player.grade}</td>
                    <td className="p-3 font-mono text-emerald-400">{player.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
          <h3 className="font-bold text-white">Update Tier Grade</h3>
          {selectedUser && (
            <form onSubmit={handleUpdateGrade} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Grade</label>
                <select 
                  value={newGrade} 
                  onChange={e => setNewGrade(e.target.value as SkillGrade)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                >
                  <option value="S (Pro)">S (Pro Level)</option>
                  <option value="A (Advanced)">A (Advanced)</option>
                  <option value="B (Upper Inter)">B (Upper Inter)</option>
                  <option value="C (Intermediate)">C (Intermediate)</option>
                  <option value="D (Beginner)">D (Beginner)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">ELO Score</label>
                <input 
                  type="number" 
                  value={newElo} 
                  onChange={e => setNewElo(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                />
              </div>
              <button type="submit" className="w-full bg-amber-500 text-slate-950 font-bold py-2 rounded text-xs">
                Save Skill Grade
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// --- BILLING VIEW ---
function BillingView({ invoices, setInvoices, showToast }: any) {
  const handleMarkAsPaid = (invId: string) => {
    setInvoices(invoices.map((i: any) => i.id === invId ? { ...i, status: 'Paid' } : i));
    showToast(`Invoice ${invId} marked as PAID!`, 'success');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white flex items-center space-x-2">
        <CreditCard className="w-5 h-5 text-emerald-400" />
        <span>Billing & Invoices</span>
      </h2>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-mono">
            <tr>
              <th className="p-3">Ref</th>
              <th className="p-3">Player</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoices.map((inv: any) => (
              <tr key={inv.id}>
                <td className="p-3 font-mono text-slate-400">{inv.id}</td>
                <td className="p-3 font-bold text-white">{inv.playerName}</td>
                <td className="p-3 font-mono text-emerald-400">${inv.amount}.00</td>
                <td className="p-3">{inv.status}</td>
                <td className="p-3 text-right">
                  {inv.status !== 'Paid' && (
                    <button onClick={() => handleMarkAsPaid(inv.id)} className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs">
                      Collect Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- USER MANAGEMENT VIEW (SUPER ADMIN TOOL) ---
function UserManagementView({ 
  users, setUsers, currentUser, showToast 
}: { 
  users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>; currentUser: User | null; showToast: (msg: string, type?: any) => void; 
}) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const filteredUsers = users.filter(u => {
    const s = searchTerm.toLowerCase();
    const pid = (u.playerId || u.player_id || '').toLowerCase();
    const name = u.name.toLowerCase();
    return pid.includes(s) || name.includes(s) || u.role.toLowerCase().includes(s);
  });

  const handleSaveUserEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!isSuperAdmin) {
      showToast('⚠️ Action restricted: Only Super Admins can alter user record values!', 'error');
      return;
    }

    setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
    showToast(`User values updated for ${editingUser.name} (${editingUser.playerId})`, 'success');
    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Registered User Directory & Admin Console</span>
          </h2>
          <p className="text-xs text-slate-400">
            {isSuperAdmin 
              ? '👑 Super Admin Mode: You have full access to edit user IDs, roles, grades, and ratings.' 
              : '🔒 View-only mode. Sign in as Super Admin to edit values.'}
          </p>
        </div>

        <input
          type="text"
          placeholder="Search by ID or Name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white w-full sm:w-64 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Unique ID</th>
                <th className="p-3">Player Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Skill Grade</th>
                <th className="p-3">ELO</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-emerald-400">
                    {user.playerId || user.player_id}
                  </td>
                  <td className="p-3 font-semibold text-slate-100 flex items-center space-x-2">
                    <img src={user.avatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                    <span>{user.name}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      user.role === 'SUPER_ADMIN' ? 'bg-rose-950 text-rose-300 border-rose-700' :
                      user.role === 'MEMBER' ? 'bg-cyan-950 text-cyan-300 border-cyan-700' :
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 font-mono">{user.grade}</td>
                  <td className="p-3 font-mono font-bold text-emerald-400">{user.elo}</td>
                  <td className="p-3 font-mono text-slate-400">{user.whatsapp}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      user.membershipStatus === 'Active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {user.membershipStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {isSuperAdmin ? (
                      <button
                        onClick={() => setEditingUser(user)}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] px-2 py-1 rounded transition"
                      >
                        Edit Values
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[10px] italic">Read Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT USER MODAL FOR SUPER ADMIN */}
      {editingUser && isSuperAdmin && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">
              Edit Account Values: {editingUser.name}
            </h3>

            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Unique Player ID</label>
                  <input
                    type="text"
                    value={editingUser.playerId}
                    onChange={e => setEditingUser({ ...editingUser, playerId: e.target.value, player_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Prefix: AD-)</option>
                    <option value="MEMBER">MEMBER (Prefix: MB-)</option>
                    <option value="PLAYER">PLAYER (Prefix: SH-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Skill Grade</label>
                  <select
                    value={editingUser.grade}
                    onChange={e => setEditingUser({ ...editingUser, grade: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="S (Pro)">S (Pro)</option>
                    <option value="A (Advanced)">A (Advanced)</option>
                    <option value="B (Upper Inter)">B (Upper Inter)</option>
                    <option value="C (Intermediate)">C (Intermediate)</option>
                    <option value="D (Beginner)">D (Beginner)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ELO Score</label>
                  <input
                    type="number"
                    value={editingUser.elo}
                    onChange={e => setEditingUser({ ...editingUser, elo: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={editingUser.whatsapp}
                    onChange={e => setEditingUser({ ...editingUser, whatsapp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-1.5 rounded text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
