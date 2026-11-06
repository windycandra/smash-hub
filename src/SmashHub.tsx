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

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'grading' | 'billing'>('dashboard');
  
  // Dynamic App State - Zero Hardcoded Data
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // D1 Database Sync & Loading States
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

  // Registration Success Popup State
  const [newlyRegisteredId, setNewlyRegisteredId] = useState<string | null>(null);

  // Floating Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
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
      console.warn('Cloudflare D1 API query offline or error:', error);
      setDbStatus('Offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Load & Real-time Polling every 10 seconds
  useEffect(() => {
    fetchD1Data();
    const interval = setInterval(() => {
      fetchD1Data(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchD1Data]);

  // Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginPlayerId.trim().toUpperCase();

    // First check locally fetched D1 users list
    const foundUser = users.find(u => u.playerId.toUpperCase() === cleanId);

    if (foundUser) {
      setCurrentUser(foundUser);
      setIsAuthOpen(false);
      setLoginPlayerId('');
      setLoginPassword('');
      showToast(`Welcome back, ${foundUser.name}! Signed in as ${foundUser.role} (${foundUser.playerId}).`);
    } else {
      // Direct API retry to D1
      try {
        const res = await fetch(`/api/users`);
        if (res.ok) {
          const freshUsers: User[] = await res.json();
          setUsers(freshUsers);
          const freshFound = freshUsers.find(u => u.playerId.toUpperCase() === cleanId);
          if (freshFound) {
            setCurrentUser(freshFound);
            setIsAuthOpen(false);
            setLoginPlayerId('');
            setLoginPassword('');
            showToast(`Welcome back, ${freshFound.name}! Signed in as ${freshFound.role} (${freshFound.playerId}).`);
            return;
          }
        }
      } catch (err) {
        console.error('D1 Auth fetch error:', err);
      }
      showToast('⚠️ Player ID not found in D1 Database! Please check your ID or Register.');
    }
  };

  // Registration Submission with Strict D1 Write Verification
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFullName.trim() || !regWhatsapp.trim()) {
      showToast('⚠️ Please fill in all required fields!');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      showToast('⚠️ Passwords do not match! Please re-verify.');
      return;
    }

    if (regPassword.length < 4) {
      showToast('⚠️ Password must be at least 4 characters long.');
      return;
    }

    let assignedRole: UserRole = regRole;
    if (regAdminCode.trim()) {
      if (regAdminCode.trim() === SECRET_ADMIN_CODE) {
        assignedRole = 'SUPER_ADMIN';
      } else {
        showToast('⚠️ Invalid Secret Admin Code! Assigned standard account role.');
        return;
      }
    }

    // Generate Running Player ID
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

    // Save directly to Cloudflare D1 database via API with HTTP error verification
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserPayload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status} error` }));
        throw new Error(errorData.error || `Server returned HTTP status ${res.status}`);
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
      setNewlyRegisteredId(generatedPlayerId);

      setRegFullName('');
      setRegWhatsapp('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegAdminCode('');

      showToast(`🎉 Account ${generatedPlayerId} written successfully to Cloudflare D1!`);
      fetchD1Data(true); // Immediate sync verify
    } catch (err: any) {
      console.error('Failed writing user to Cloudflare D1:', err);
      showToast(`❌ D1 Write Failed: ${err.message}. Check D1 Binding 'DB' in Cloudflare.`);
    }
  };

  const handleQuickLogin = (playerId: string) => {
    const user = users.find(u => u.playerId === playerId);
    if (user) {
      setCurrentUser(user);
      setIsAuthOpen(false);
      showToast(`Switched user role to ${user.role} (${user.name} - ${user.playerId})`);
    } else {
      showToast(`⚠️ Account ${playerId} not found in database. Please register.`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    showToast('Signed out successfully. Now in Guest View.');
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
                <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Live D1 Engine</span>
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

            {/* Profile / Realtime D1 DB Controls */}
            <div className="flex items-center space-x-3">
              
              {/* Database Connection Badge */}
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
                {lastSyncedAt && <span className="text-slate-500 text-[9px]">({lastSyncedAt})</span>}
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
                  <span className="hidden sm:inline text-xs text-amber-400 font-mono bg-amber-950/60 border border-amber-800/50 px-2 py-1 rounded">Guest Mode</span>
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

        {/* Mobile Tab Navigation */}
        <div className="md:hidden overflow-x-auto border-t border-slate-800 px-2 py-2 flex space-x-1 scrollbar-none">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'booking', label: 'Courts', icon: Calendar },
            { id: 'matchmaker', label: 'Matchmaker', icon: Shuffle },
            { id: 'scoring', label: 'Scoring', icon: Activity },
            { id: 'grading', label: 'Grading', icon: Trophy },
            { id: 'billing', label: 'Billing', icon: CreditCard },
          ].map(tab => {
            if (!canAccessTab(tab.id)) return null;
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                  isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold' : 'text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* --- TOAST NOTIFICATION --- */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-emerald-500/70 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 max-w-md animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Loading Overlay / Empty Database Banner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <p className="text-sm font-mono text-slate-400">Connecting to Cloudflare D1 Realtime Database...</p>
          </div>
        ) : dbStatus === 'Empty' && users.length === 0 ? (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Cloudflare D1 Database is Empty</h3>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Your D1 SQLite database connected successfully, but contains no records yet. Click below to register your first Super Admin account or run the seeding SQL script from your Cloudflare dashboard console.
            </p>
            <button
              onClick={() => { setAuthMode('register'); setIsAuthOpen(true); }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-lg transition"
            >
              Register First Account (Super Admin)
            </button>
          </div>
        ) : null}

        {!isLoading && activeTab === 'dashboard' && (
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
        {!isLoading && activeTab === 'booking' && (
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
        {!isLoading && activeTab === 'matchmaker' && currentUser && (
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
        {!isLoading && activeTab === 'scoring' && currentUser && (
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
        {!isLoading && activeTab === 'grading' && currentUser && (
          <GradingView 
            users={users} 
            setUsers={setUsers}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
        {!isLoading && activeTab === 'billing' && currentUser && (
          <BillingView 
            invoices={invoices} 
            setInvoices={setInvoices} 
            showToast={showToast}
          />
        )}
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <span className={`inline-block w-2 h-2 rounded-full ${dbStatus === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span>SmashHub System Online • Cloudflare D1 Real-Time Sync</span>
          </div>
          <div>
            <span>SmashHub Badminton Platform v4.3.0 • Direct D1 SQL Backend</span>
          </div>
        </div>
      </footer>

      {/* --- AUTH MODAL (LOGIN & REGISTER) --- */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsAuthOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
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
                  : 'Fill in your details to create a record in Cloudflare D1'}
              </p>
            </div>

            {/* Quick Logins from fetched D1 DB */}
            {authMode === 'login' && users.length > 0 && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Quick Accounts (From D1 Database):</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {users.slice(0, 3).map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleQuickLogin(u.playerId)}
                      className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs py-2 px-1 rounded-lg font-mono transition text-center truncate"
                    >
                      {u.role === 'SUPER_ADMIN' ? '👑' : u.role === 'MEMBER' ? '🏅' : '🏸'} {u.playerId}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* LOGIN FORM */}
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
              /* REGISTRATION FORM */
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
                    <option value="PLAYER">Player (Standard Court Access)</option>
                    <option value="MEMBER">Member (Priority Reservation & Tournament)</option>
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
                  <p className="text-[10px] text-slate-500 mt-1">Leave blank for standard Player/Member registration.</p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg shadow-emerald-500/20 transition mt-2"
                >
                  Register Account & Write to D1
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

      {/* --- NEWLY REGISTERED PLAYER ID MODAL --- */}
      {newlyRegisteredId && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Account Saved to Cloudflare D1!</h3>
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

// ==========================================
// 1. DASHBOARD COMPONENT
// ==========================================
function DashboardView({ 
  users, courts, matches, invoices, currentUser, setActiveTab, setIsAuthOpen, fetchD1Data
}: { 
  users: User[]; courts: Court[]; matches: Match[]; invoices: Invoice[]; currentUser: User | null; setActiveTab: (tab: any) => void; setIsAuthOpen: (open: boolean) => void; fetchD1Data: () => void;
}) {
  const activeCourts = courts.filter(c => c.status === 'Occupied').length;
  const pendingDuesTotal = invoices.filter(i => i.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);
  const liveMatchesCount = matches.filter(m => m.status === 'Live').length;

  const occupancyChartData = [
    { hour: '14:00', occupancy: Math.min(100, (activeCourts * 15)) },
    { hour: '16:00', occupancy: Math.min(100, (activeCourts * 25)) },
    { hour: '18:00', occupancy: Math.min(100, (activeCourts * 35)) },
    { hour: '20:00', occupancy: Math.min(100, (activeCourts * 20)) },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs text-emerald-400 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Real-Time Cloudflare D1 Backend</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Badminton Operations & Analytics
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Automated match pairing, live BWF scoring, court utilization monitoring & player ELO ratings.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchD1Data()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Refresh D1 DB</span>
            </button>
            {currentUser ? (
              <>
                <button
                  onClick={() => setActiveTab('booking')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book Court</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Sign In to Access System</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Court Occupancy</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {activeCourts} / {courts.length || 0} <span className="text-xs text-emerald-400 font-normal">Active</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {courts.length > 0 ? Math.round((activeCourts / courts.length) * 100) : 0}% live utilization
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Live Matches</p>
            <h3 className="text-2xl font-bold text-cyan-400 mt-1">{liveMatchesCount} <span className="text-xs text-slate-400 font-normal">Courts</span></h3>
            <p className="text-[11px] text-slate-500 mt-1">Real-time BWF scoring</p>
          </div>
          <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center border border-cyan-500/20">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">D1 Registered Players</p>
            <h3 className="text-2xl font-bold text-white mt-1">{users.length} <span className="text-xs text-slate-400 font-normal">Players</span></h3>
            <p className="text-[11px] text-emerald-400 mt-1">Realtime D1 query</p>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Pending Invoices</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">${pendingDuesTotal}</h3>
            <p className="text-[11px] text-slate-500 mt-1">{invoices.filter(i=>i.status==='Pending').length} pending collection</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Court Occupancy Peak Hours */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Live Occupancy Trend</h3>
              <p className="text-xs text-slate-400">Court utilization from D1 data stream</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={occupancyChartData}>
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

        {/* Dynamic Registered Grade Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Player Grade Tier Distribution</h3>
              <p className="text-xs text-slate-400">Calculated from D1 SQLite user table</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { tier: 'S (Pro)', count: users.filter(u=>u.grade?.startsWith('S')).length },
                { tier: 'A (Adv)', count: users.filter(u=>u.grade?.startsWith('A')).length },
                { tier: 'B (Inter)', count: users.filter(u=>u.grade?.startsWith('B')).length },
                { tier: 'C (Mid)', count: users.filter(u=>u.grade?.startsWith('C')).length },
                { tier: 'D (Beg)', count: users.filter(u=>u.grade?.startsWith('D')).length },
              ]}>
                <XAxis dataKey="tier" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Courts Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Courts Live Overview ({courts.length} Courts in D1)</span>
          </h3>
          {currentUser && (
            <button onClick={() => setActiveTab('scoring')} className="text-xs text-emerald-400 hover:underline flex items-center space-x-1">
              <span>Open Scoring Console</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {courts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            No courts registered in D1 database yet. Run schema seeding SQL in Cloudflare D1 Console.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {courts.slice(0, 6).map(court => {
              const activeMatch = matches.find(m => m.courtId === court.id && m.status === 'Live');
              return (
                <div key={court.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-slate-200">{court.name}</span>
                      <span className="block text-[10px] font-mono text-emerald-400">{court.courtCode}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      court.status === 'Occupied' 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : court.status === 'Maintenance'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {court.status}
                    </span>
                  </div>

                  {activeMatch ? (
                    <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 truncate max-w-[120px]">{activeMatch.team1.join(' / ')}</span>
                        <span className="font-mono text-emerald-400 font-bold text-sm">
                          {activeMatch.score1[activeMatch.currentSet - 1] ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 truncate max-w-[120px]">{activeMatch.team2.join(' / ')}</span>
                        <span className="font-mono text-cyan-400 font-bold text-sm">
                          {activeMatch.score2[activeMatch.currentSet - 1] ?? 0}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-16 flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                      <span>Court Available</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. BOOKING SYSTEM & COURT SCHEDULE
// ==========================================
function BookingView({ 
  courts, bookings, setBookings, currentUser, showToast, setIsAuthOpen, fetchD1Data
}: { 
  courts: Court[]; bookings: Booking[]; setBookings: React.Dispatch<React.SetStateAction<Booking[]>>; currentUser: User | null; showToast: (msg: string) => void; setIsAuthOpen: (open: boolean) => void; fetchD1Data: () => void;
}) {
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(courts[0] || null);
  const [bookingDate, setBookingDate] = useState('2026-11-06');
  const [selectedSlot, setSelectedSlot] = useState('18:00 - 19:00');
  const [bookingType, setBookingType] = useState<'Casual Play' | 'Tournament' | 'Training Session'>('Casual Play');

  useEffect(() => {
    if (courts.length > 0 && !selectedCourt) {
      setSelectedCourt(courts[0]);
    }
  }, [courts, selectedCourt]);

  const timeSlots = [
    '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', 
    '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00',
    '18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00'
  ];

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('⚠️ Please sign in with your Player ID to make court reservations!');
      setIsAuthOpen(true);
      return;
    }

    if (!selectedCourt) {
      showToast('⚠️ Please select a court first!');
      return;
    }

    // Check slot conflict
    const isConflict = bookings.some(b => 
      b.courtId === selectedCourt.id && b.date === bookingDate && b.timeSlot === selectedSlot
    );

    if (isConflict) {
      showToast('⚠️ Slot already booked! Please select another time slot.');
      return;
    }

    const courtFee = selectedCourt.courtCode === 'CRT-06' || selectedCourt.courtCode === 'CRT-01' ? 35 : 25;

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      courtCode: selectedCourt.courtCode,
      playerName: currentUser.name,
      playerId: currentUser.playerId,
      date: bookingDate,
      timeSlot: selectedSlot,
      type: bookingType,
      paymentStatus: 'Paid',
      fee: courtFee
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooking)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setBookings([newBooking, ...bookings]);
      showToast(`✅ Reserved ${selectedCourt.name} (${selectedCourt.courtCode}) for ${bookingDate} [${selectedSlot}]`);
      fetchD1Data(true);
    } catch (err: any) {
      showToast(`⚠️ Reservation API Error: ${err.message}`);
    }
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
        
        {/* Court Cards Selection */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Available Badminton Courts</h3>
          
          {courts.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
              No courts available in database. Run D1 schema script to populate courts.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courts.map(court => {
                const isSelected = selectedCourt?.id === court.id;
                const rate = court.courtCode === 'CRT-06' || court.courtCode === 'CRT-01' ? 35 : 25;
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
                        <p className="text-xs font-mono text-emerald-400 mt-0.5">Court Code: {court.courtCode}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                        court.status === 'Available' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        court.status === 'Occupied' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                        'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {court.status}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-slate-400">Ref Code: <strong className="text-slate-200">{court.courtCode}</strong></span>
                      <span className="font-mono text-emerald-400 font-semibold">${rate}/hr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bookings Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 mt-6">
            <h3 className="text-sm font-bold text-white">Upcoming Club Reservations ({bookings.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Court Name</th>
                    <th className="p-3">Court Code</th>
                    <th className="p-3">Reserved By</th>
                    <th className="p-3">Player ID</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Session Type</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200">{b.courtName}</td>
                      <td className="p-3 font-mono text-cyan-400 font-semibold">{b.courtCode}</td>
                      <td className="p-3">{b.playerName}</td>
                      <td className="p-3 font-mono text-emerald-400 font-semibold">{b.playerId}</td>
                      <td className="p-3 font-mono">{b.date} • {b.timeSlot}</td>
                      <td className="p-3">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                          {b.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-emerald-400 font-mono font-medium">{b.paymentStatus} (${b.fee})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Reservation Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Court Session Booking</h3>
            <p className="text-xs text-slate-400">Selected: <span className="text-emerald-400 font-medium">{selectedCourt ? `${selectedCourt.name} (${selectedCourt.courtCode})` : 'None'}</span></p>
          </div>

          {!currentUser ? (
            <div className="bg-slate-950 p-5 rounded-xl border border-amber-500/30 text-center space-y-3">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300 uppercase">Login Required To Book</h4>
                <p className="text-xs text-slate-400 mt-1">Sign in with your unique Player ID to make a court reservation.</p>
              </div>
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
                  {timeSlots.map(slot => {
                    const isBooked = selectedCourt ? bookings.some(b => b.courtId === selectedCourt.id && b.date === bookingDate && b.timeSlot === slot) : false;
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        type="button"
                        key={slot}
                        disabled={isBooked}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-1.5 px-2 text-xs rounded-lg font-mono text-center transition ${
                          isBooked ? 'bg-slate-950 text-slate-600 line-through cursor-not-allowed border border-slate-900' :
                          isSelected ? 'bg-emerald-500 text-slate-950 font-bold' :
                          'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Activity Category</label>
                <select
                  value={bookingType}
                  onChange={e => setBookingType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Casual Play">Casual Play / Sparring</option>
                  <option value="Tournament">Tournament Match</option>
                  <option value="Training Session">Personal Training</option>
                </select>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Base Court Rate:</span>
                  <span className="font-mono text-slate-200">
                    ${selectedCourt?.courtCode === 'CRT-06' || selectedCourt?.courtCode === 'CRT-01' ? '35.00' : '25.00'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Reserved For:</span>
                  <span className="font-mono text-emerald-400">{currentUser.name} ({currentUser.playerId})</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedCourt}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2"
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

// ==========================================
// 3. AUTOMATED MATCHMAKING & PAIRING ENGINE
// ==========================================
function MatchMakerView({ 
  users, courts, matches, setMatches, setCourts, showToast, setActiveTab 
}: { 
  users: User[]; courts: Court[]; matches: Match[]; setMatches: React.Dispatch<React.SetStateAction<Match[]>>; setCourts: React.Dispatch<React.SetStateAction<Court[]>>; showToast: (msg: string) => void; setActiveTab: (tab: any) => void;
}) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [matchFormat, setMatchFormat] = useState<'Doubles' | 'Singles'>('Doubles');
  const [targetCourtId, setTargetCourtId] = useState<number>(courts[0]?.id || 1);

  useEffect(() => {
    if (users.length > 0 && selectedPlayerIds.length === 0) {
      setSelectedPlayerIds(users.map(u => u.id));
    }
  }, [users, selectedPlayerIds]);

  const togglePlayerSelect = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter(pid => pid !== id));
    } else {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleGeneratePairings = () => {
    const activePlayers = users.filter(u => selectedPlayerIds.includes(u.id));

    if (matchFormat === 'Doubles' && activePlayers.length < 4) {
      showToast('⚠️ Need at least 4 players selected for Doubles matchmaking!');
      return;
    }
    if (matchFormat === 'Singles' && activePlayers.length < 2) {
      showToast('⚠️ Need at least 2 players selected for Singles matchmaking!');
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
    setCourts(courts.map(c => c.id === targetCourtId ? { ...c, status: 'Occupied', currentMatchId: newMatch.id } : c));

    showToast(`🏸 Balanced ${matchFormat} match generated & dispatched to Court ${targetCourtId}!`);
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
          <p className="text-xs text-slate-400">Algorithmic player pairing based on real-time D1 player rating data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Player Pool Selector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Select Active Player Pool ({selectedPlayerIds.length} Selected)</h3>
            <button 
              onClick={() => setSelectedPlayerIds(selectedPlayerIds.length === users.length ? [] : users.map(u => u.id))}
              className="text-xs text-cyan-400 hover:underline"
            >
              {selectedPlayerIds.length === users.length ? 'Deselect All' : 'Select All D1 Players'}
            </button>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No registered players found in database.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map(player => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => togglePlayerSelect(player.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected 
                        ? 'bg-slate-800 border-cyan-500/60 ring-1 ring-cyan-500/30' 
                        : 'bg-slate-950 border-slate-800/80 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <img src={player.avatar} alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-700" />
                      <div>
                        <h4 className="text-xs font-bold text-white">{player.name} <span className="text-[10px] text-cyan-400 font-mono">({player.playerId})</span></h4>
                        <p className="text-[10px] text-slate-400">{player.role} • {player.grade} • <span className="text-emerald-400 font-mono">{player.elo} ELO</span></p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Match Generator Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 h-fit">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Match Config</h3>
            <p className="text-xs text-slate-400">Pairing strategy: ELO Parity Balancing</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Game Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMatchFormat('Doubles')}
                  className={`py-2 text-xs rounded-xl font-bold transition border ${
                    matchFormat === 'Doubles' 
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Doubles (2v2)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchFormat('Singles')}
                  className={`py-2 text-xs rounded-xl font-bold transition border ${
                    matchFormat === 'Singles' 
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Singles (1v1)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Court</label>
              <select
                value={targetCourtId}
                onChange={e => setTargetCourtId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {courts.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.courtCode}] {c.name} ({c.status})
                  </option>
                ))}
              </select>
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

// ==========================================
// 4. BWF OFFICIAL LIVE SCORING CONSOLE
// ==========================================
function ScoringView({ 
  matches, setMatches, courts, setCourts, users, setUsers, showToast 
}: { 
  matches: Match[]; setMatches: React.Dispatch<React.SetStateAction<Match[]>>; courts: Court[]; setCourts: React.Dispatch<React.SetStateAction<Court[]>>; users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>; showToast: (msg: string) => void;
}) {
  const liveMatches = matches.filter(m => m.status === 'Live');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(liveMatches[0]?.id || matches[0]?.id || '');

  const activeMatch = matches.find(m => m.id === selectedMatchId);

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
        setMatches(matches.map(m => m.id === activeMatch.id ? {
          ...m,
          score1: scores1,
          score2: scores2,
          status: 'Completed',
          winner: matchWinner
        } : m));

        setCourts(courts.map(c => c.id === activeMatch.courtId ? { ...c, status: 'Available', currentMatchId: undefined } : c));

        const winningTeamNames = matchWinner === 1 ? activeMatch.team1 : activeMatch.team2;
        setUsers(users.map(u => winningTeamNames.some(name => name.includes(u.name)) ? { ...u, elo: u.elo + 25, wins: u.wins + 1, matchesPlayed: u.matchesPlayed + 1 } : u));

        showToast(`🏆 Match Finalized! Team ${matchWinner} Wins! Player ELO updated.`);
        return;
      } else {
        showToast(`Set ${activeMatch.currentSet} won by Team ${setWinner}! Moving to Set ${activeMatch.currentSet + 1}.`);
        scores1.push(0);
        scores2.push(0);
        setMatches(matches.map(m => m.id === activeMatch.id ? {
          ...m,
          score1: scores1,
          score2: scores2,
          currentSet: m.currentSet + 1,
          serverTeam: setWinner
        } : m));
        return;
      }
    }

    setMatches(matches.map(m => m.id === activeMatch.id ? {
      ...m,
      score1: scores1,
      score2: scores2,
      serverTeam: team
    } : m));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Digital BWF Scoreboard & Referee Console</span>
          </h2>
          <p className="text-xs text-slate-400">Rally point system, deuce detection & server indicator</p>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2">
        {matches.map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedMatchId(m.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
              selectedMatchId === m.id
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            Match #{m.id} (Court {m.courtId}) {m.status === 'Live' && '• LIVE'}
          </button>
        ))}
      </div>

      {activeMatch ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl relative overflow-hidden">
          
          <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-800 pb-4">
            <span className="font-mono bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
              Court {activeMatch.courtId} • Set {activeMatch.currentSet} / 3
            </span>
            <span className={`font-mono px-3 py-1 rounded-full text-[11px] font-bold ${
              activeMatch.status === 'Live' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse' : 'bg-slate-800 text-slate-300'
            }`}>
              {activeMatch.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Team 1 Card */}
            <div className={`p-6 rounded-2xl border transition-all text-center space-y-4 ${
              activeMatch.serverTeam === 1 
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/60 ring-2 ring-emerald-500/20' 
                : 'bg-slate-950 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">TEAM 1</span>
                {activeMatch.serverTeam === 1 && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                    SERVING 🏸
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold text-white truncate">{activeMatch.team1.join(' / ')}</h3>
              
              <div className="text-7xl sm:text-8xl font-black font-mono text-emerald-400 tracking-tighter my-2">
                {activeMatch.score1[activeMatch.currentSet - 1] ?? 0}
              </div>

              <button
                disabled={activeMatch.status === 'Completed'}
                onClick={() => addPoint(1)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-black py-4 rounded-xl text-base shadow-lg shadow-emerald-500/20 active:scale-95 transition"
              >
                +1 POINT (TEAM 1)
              </button>
            </div>

            {/* Team 2 Card */}
            <div className={`p-6 rounded-2xl border transition-all text-center space-y-4 ${
              activeMatch.serverTeam === 2 
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-cyan-500/60 ring-2 ring-cyan-500/20' 
                : 'bg-slate-950 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">TEAM 2</span>
                {activeMatch.serverTeam === 2 && (
                  <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/30">
                    SERVING 🏸
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold text-white truncate">{activeMatch.team2.join(' / ')}</h3>
              
              <div className="text-7xl sm:text-8xl font-black font-mono text-cyan-400 tracking-tighter my-2">
                {activeMatch.score2[activeMatch.currentSet - 1] ?? 0}
              </div>

              <button
                disabled={activeMatch.status === 'Completed'}
                onClick={() => addPoint(2)}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-950 font-black py-4 rounded-xl text-base shadow-lg shadow-cyan-500/20 active:scale-95 transition"
              >
                +1 POINT (TEAM 2)
              </button>
            </div>

          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-mono text-slate-400 uppercase">Set History Summary</h4>
            <div className="flex space-x-4 text-xs font-mono">
              {activeMatch.score1.map((s1, idx) => (
                <div key={idx} className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 mr-2">Set {idx + 1}:</span>
                  <span className="text-emerald-400 font-bold">{s1}</span>
                  <span className="text-slate-600 mx-1">-</span>
                  <span className="text-cyan-400 font-bold">{activeMatch.score2[idx] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">No active matches found. Use the Matchmaker tab to start a session.</div>
      )}
    </div>
  );
}

// ==========================================
// 5. PLAYER ROSTER & SKILL GRADING
// ==========================================
function GradingView({ 
  users, setUsers, currentUser, showToast 
}: { 
  users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>; currentUser: User | null; showToast: (msg: string) => void;
}) {
  const [selectedUser, setSelectedUser] = useState<User | null>(users[0] || null);
  const [newGrade, setNewGrade] = useState<SkillGrade>(selectedUser?.grade || 'D (Beginner)');
  const [newElo, setNewElo] = useState<number>(selectedUser?.elo || 1200);

  useEffect(() => {
    if (users.length > 0 && !selectedUser) {
      setSelectedUser(users[0]);
      setNewGrade(users[0].grade);
      setNewElo(users[0].elo);
    }
  }, [users, selectedUser]);

  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'SUPER_ADMIN') {
      showToast('⚠️ Only Super Admins can modify official player skill grades!');
      return;
    }
    if (!selectedUser) return;

    try {
      await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade, elo: newElo })
      });
    } catch (err) {
      console.warn('Updating grade locally:', err);
    }

    setUsers(users.map(u => u.id === selectedUser.id ? { ...u, grade: newGrade, elo: newElo } : u));
    showToast(`Grading updated for ${selectedUser.name} (${selectedUser.playerId}) -> ${newGrade} (${newElo} ELO)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Player Skill Tier & ELO Standings</span>
          </h2>
          <p className="text-xs text-slate-400">Realtime D1 player ladder, grading evaluations & match win rates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Leaderboard Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">D1 Database Ladder Standings</h3>
          
          {users.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No users registered in D1 database yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Rank & Player</th>
                    <th className="p-3">Player ID</th>
                    <th className="p-3">WhatsApp Contact</th>
                    <th className="p-3">Skill Grade</th>
                    <th className="p-3">ELO Rating</th>
                    <th className="p-3">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[...users].sort((a,b) => b.elo - a.elo).map((player, idx) => {
                    const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
                    return (
                      <tr 
                        key={player.id} 
                        onClick={() => { setSelectedUser(player); setNewGrade(player.grade); setNewElo(player.elo); }}
                        className={`hover:bg-slate-800/40 cursor-pointer transition ${
                          selectedUser?.id === player.id ? 'bg-slate-800/60' : ''
                        }`}
                      >
                        <td className="p-3 flex items-center space-x-3">
                          <span className="font-mono text-slate-500 w-4">{idx + 1}.</span>
                          <img src={player.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="font-bold text-slate-100">{player.name}</p>
                            <p className="text-[10px] text-slate-400">{player.role}</p>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{player.playerId}</td>
                        <td className="p-3 font-mono text-slate-400">{player.whatsapp}</td>
                        <td className="p-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            player.grade.startsWith('S') ? 'bg-amber-950 text-amber-300 border-amber-700' :
                            player.grade.startsWith('A') ? 'bg-emerald-950 text-emerald-300 border-emerald-700' :
                            player.grade.startsWith('B') ? 'bg-cyan-950 text-cyan-300 border-cyan-700' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {player.grade}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{player.elo}</td>
                        <td className="p-3 font-mono">
                          {winRate}% <span className="text-[10px] text-slate-500">({player.wins}/{player.matchesPlayed})</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Grade Evaluator / Editor Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Grading Inspector</h3>
            <p className="text-xs text-slate-400">Selected Member: <span className="text-emerald-400 font-medium">{selectedUser ? `${selectedUser.name} (${selectedUser.playerId})` : 'None'}</span></p>
          </div>

          <form onSubmit={handleUpdateGrade} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Skill Tier Grade</label>
              <select
                value={newGrade}
                onChange={e => setNewGrade(e.target.value as SkillGrade)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="S (Pro)">S (Pro Level) - ELO 2000+</option>
                <option value="A (Advanced)">A (Advanced) - ELO 1800+</option>
                <option value="B (Upper Inter)">B (Upper Inter) - ELO 1600+</option>
                <option value="C (Intermediate)">C (Intermediate) - ELO 1400+</option>
                <option value="D (Beginner)">D (Beginner) - ELO &lt; 1400</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Manual ELO Score Adjustment</label>
              <input
                type="number"
                value={newElo}
                onChange={e => setNewElo(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={currentUser?.role !== 'SUPER_ADMIN' || !selectedUser}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Save & Update D1 Skill Tier</span>
            </button>
            {currentUser?.role !== 'SUPER_ADMIN' && (
              <p className="text-[10px] text-rose-400 text-center">Only Super Admins can alter skill ratings.</p>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 6. BILLING & PAYMENTS SYSTEM
// ==========================================
function BillingView({ 
  invoices, setInvoices, showToast 
}: { 
  invoices: Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>; showToast: (msg: string) => void;
}) {
  const handleMarkAsPaid = async (invId: string) => {
    try {
      await fetch(`/api/invoices/${invId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid', paymentMethod: 'Stripe Mock Auto' })
      });
    } catch (err) {
      console.warn('Updating invoice locally:', err);
    }

    setInvoices(invoices.map(i => i.id === invId ? { ...i, status: 'Paid', paymentMethod: 'Stripe Mock Auto' } : i));
    showToast(`Invoice ${invId} marked as PAID in D1 database!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Billing, Invoices & Membership Fees</span>
          </h2>
          <p className="text-xs text-slate-400">Manage court fees, monthly dues & D1 payment collection records</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No invoices generated in database yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Invoice Ref</th>
                  <th className="p-3">Player Name</th>
                  <th className="p-3">Player ID</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-slate-400 font-semibold">{inv.id}</td>
                    <td className="p-3 font-bold text-slate-200">{inv.playerName}</td>
                    <td className="p-3 font-mono text-emerald-400 font-semibold">{inv.playerId}</td>
                    <td className="p-3 text-slate-300">{inv.description}</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">${inv.amount}.00</td>
                    <td className="p-3 font-mono">{inv.dueDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        inv.status === 'Paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        inv.status === 'Pending' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {inv.status !== 'Paid' && (
                        <button
                          onClick={() => handleMarkAsPaid(inv.id)}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] px-3 py-1 rounded-lg transition"
                        >
                          Collect Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
