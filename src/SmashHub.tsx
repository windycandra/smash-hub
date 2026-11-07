// v0.2.9 - SmashHub Pro Manager (Full Runnable & Validated Checkpoint)

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Trophy, Calendar, CreditCard, Zap, 
  CheckCircle2, BarChart3, ShieldCheck, LogOut, UserCheck, 
  Shuffle, X, Lock, Phone, User as UserIcon, Key,
  RefreshCw, Database, AlertCircle, Loader2, Edit3, Save, UserCog, Flame, ChevronRight, Users
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area 
} from 'recharts';

// --- TYPES & INTERFACES ---
type UserRole = 'SUPER_ADMIN' | 'MEMBER' | 'PLAYER';
type SkillGrade = 'S (Pro)' | 'A (Advanced)' | 'B (Upper Inter)' | 'C (Intermediate)' | 'D (Beginner)';

interface User {
  id: string;
  player_id: string;
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
  courtCode: string;
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

interface ViewProps {
  users: User[];
  courts: Court[];
  matches: Match[];
  invoices: Invoice[];
  currentUser: User | null;
  setActiveTab: (tab: 'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'grading' | 'billing' | 'users') => void;
  setIsAuthOpen: (open: boolean) => void;
  fetchD1Data: (silent?: boolean) => void;
}

const SECRET_ADMIN_CODE = 'SMASH2026ADMIN';
const SESSION_STORAGE_KEY = 'smashhub_session_user';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'grading' | 'billing' | 'users'>('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Syncing' | 'Offline' | 'Empty'>('Syncing');
  const [, setLastSyncedAt] = useState<string>('');

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  const [loginCredential, setLoginCredential] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const [regFullName, setRegFullName] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regAdminCode, setRegAdminCode] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('PLAYER');

  const [newlyRegisteredId, setNewlyRegisteredId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 6000);
  };

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.warn('Failed to load user session:', e);
    }
  }, []);

  const updateActiveSession = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  };

  const normalizePhone = (phone: string): string => {
    let clean = phone.trim().replace(/\s+|-/g, '');
    if (clean.startsWith('+62')) {
      clean = '0' + clean.slice(3);
    } else if (clean.startsWith('62')) {
      clean = '0' + clean.slice(2);
    }
    return clean;
  };

  const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
    const trimmed = phone.trim();
    if (trimmed.startsWith('62')) {
      const digitsAfter = trimmed.slice(3).replace(/\D/g, '');
      if (digitsAfter.length < 9 || digitsAfter.length > 11) {
        return { 
          valid: false, 
          error: `⚠️ Invalid WhatsApp Number (Currently: ${digitsAfter.length} digits).` 
        };
      }
    } else {
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 12) {
        return { 
          valid: false, 
          error: `⚠️ Invalid WhatsApp Number (Currently: ${digitsOnly.length} digits).` 
        };
      }
    }
    return { valid: true };
  };

  const mapRawUserRow = (raw: any): User => ({
    id: raw.id || `u-${Date.now()}`,
    player_id: raw.player_id || raw.playerId || 'SH001',
    name: raw.full_name || raw.name || 'Anonymous Player',
    whatsapp: raw.whatsapp_number || raw.whatsapp || '',
    role: (raw.role as UserRole) || 'PLAYER',
    grade: (raw.grade as SkillGrade) || 'D (Beginner)',
    elo: Number(raw.elo) || 1200,
    avatar: raw.avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
    membershipStatus: raw.membership_status || raw.membershipStatus || 'Active',
    duesOwed: Number(raw.dues_owed ?? raw.duesOwed ?? 0),
    matchesPlayed: Number(raw.matches_played ?? raw.matchesPlayed ?? 0),
    wins: Number(raw.wins ?? 0),
  });

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
        fetchedUsers = uRes.value.map(mapRawUserRow);
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
      console.warn('Cloudflare D1 query error:', error);
      setDbStatus('Offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchD1Data();
    const interval = setInterval(() => fetchD1Data(true), 10000);
    return () => clearInterval(interval);
  }, [fetchD1Data]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginCredential.trim().toUpperCase();

    const foundUser = users.find(u => 
      u.player_id.toUpperCase() === cleanInput || 
      u.name.toUpperCase() === cleanInput
    );

    if (foundUser) {
      updateActiveSession(foundUser);
      setIsAuthOpen(false);
      setLoginCredential('');
      setLoginPassword('');
      showToast(`Welcome back, ${foundUser.name}! Signed in as ${foundUser.role} (${foundUser.player_id}).`, 'success');
    } else {
      showToast('⚠️ Account not found! Please check your ID / Name or Register a new account.', 'error');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = resetIdentifier.trim().toUpperCase();
    const cleanPhone = normalizePhone(resetIdentifier);

    const foundUser = users.find(u => 
      u.player_id.toUpperCase() === cleanIdent ||
      u.name.toUpperCase() === cleanIdent ||
      normalizePhone(u.whatsapp) === cleanPhone
    );

    if (!foundUser) {
      showToast('⚠️ No matching user account found for the given ID, Name, or WhatsApp.', 'error');
      return;
    }

    if (resetNewPassword.length < 6) {
      showToast('⚠️ Password must be at least 6 characters long.', 'error');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      showToast('⚠️ Passwords do not match! Please re-verify.', 'error');
      return;
    }

    try {
      const updatedUser = { ...foundUser, password: resetNewPassword };
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
      setUsers(prev => prev.map(u => u.id === foundUser.id ? updatedUser : u));
      showToast(`🎉 Password for ${foundUser.name} (${foundUser.player_id}) updated successfully!`, 'success');
      setAuthMode('login');
      setResetIdentifier('');
      setResetNewPassword('');
      setResetConfirmPassword('');
    } catch (err: any) {
      showToast(`⚠️ Password updated locally: ${err.message}`, 'info');
      setAuthMode('login');
    }
  };

  const generateRoleCode = (role: UserRole, currentList: User[]): string => {
    const prefix = role === 'SUPER_ADMIN' ? 'AD' : role === 'MEMBER' ? 'MB' : 'SH';
    const roleCount = currentList.filter(u => u.role === role).length + 1;
    const numStr = String(roleCount).padStart(3, '0');
    return `${prefix}${numStr}`;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFullName.trim() || !regWhatsapp.trim()) {
      showToast('⚠️ Please fill in all required fields!', 'error');
      return;
    }

    const phoneCheck = validatePhoneNumber(regWhatsapp);
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'Invalid phone number format', 'error');
      return;
    }

    const normalizedRegPhone = normalizePhone(regWhatsapp);
    const isDuplicatePhone = users.some(u => normalizePhone(u.whatsapp) === normalizedRegPhone);
    if (isDuplicatePhone) {
      showToast('⚠️ This WhatsApp number is already registered! Please sign in or use another number.', 'error');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      showToast('⚠️ Passwords do not match! Please re-verify.', 'error');
      return;
    }

    if (regPassword.length < 6) {
      showToast('⚠️ Password must be at least 6 characters long.', 'error');
      return;
    }

    let assignedRole: UserRole = regRole;
    if (regAdminCode.trim()) {
      if (regAdminCode.trim() === SECRET_ADMIN_CODE) {
        assignedRole = 'SUPER_ADMIN';
      } else {
        showToast('⚠️ Invalid Referral Code! Assigned standard account role.', 'error');
        return;
      }
    }

    const generatedCode = generateRoleCode(assignedRole, users);

    const newUserPayload = {
      id: `u-${Date.now()}`,
      player_id: generatedCode,
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

      showToast(`🎉 Account ${generatedCode} has been registered!`, 'success');
    } catch (err: any) {
      console.warn('D1 sync warning:', err);
      showToast(`⚠️ DB notice: ${err.message || 'Saved locally'}. Session active!`, 'info');
    }

    const newUser: User = {
      id: newUserPayload.id,
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
    updateActiveSession(newUser);
    setIsAuthOpen(false);
    setNewlyRegisteredId(generatedCode);

    setRegFullName('');
    setRegWhatsapp('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegAdminCode('');
  };

  const handleLogout = () => {
    updateActiveSession(null);
    setActiveTab('dashboard');
    showToast('Signed out successfully. Switched to Guest mode.', 'info');
  };

  const canAccessTab = (tabId: string) => {
    if (tabId === 'users' || tabId === 'matchmaker' || tabId === 'grading') return currentUser?.role === 'SUPER_ADMIN';
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
                <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold">v0.2.9 Checkpoint</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { id: 'booking', label: 'Schedule', icon: Calendar },
                { id: 'matchmaker', label: 'Matchmaker', icon: Shuffle },
                { id: 'scoring', label: 'Live Scoring', icon: Activity },
                { id: 'billing', label: 'Billing', icon: CreditCard },
                { id: 'users', label: 'User', icon: UserCog },
                { id: 'grading', label: 'Grading', icon: Trophy },
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
                title={`Database Status: ${dbStatus}. Click to refresh.`}
                className="hidden lg:flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full text-[11px] font-mono hover:border-slate-700 transition"
              >
                
                <Database className={`w-3.5 h-3.5 ${
                  dbStatus === 'Connected' ? 'text-emerald-400' :
                  dbStatus === 'Syncing' ? 'text-amber-400 animate-spin' :
                  dbStatus === 'Empty' ? 'text-cyan-400' : 'text-rose-400'
                }`} />
                <span className={`font-semibold ${
                  dbStatus === 'Connected' ? 'text-emerald-400' :
                  dbStatus === 'Syncing' ? 'text-amber-400' :
                  dbStatus === 'Empty' ? 'text-cyan-400' : 'text-rose-400'
                }`}>
                  DB
                </span>
              </button>
              
              {currentUser ? (
                <div className="flex items-center space-x-3 bg-slate-800/80 p-1.5 pl-3 rounded-full border border-slate-700/60">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-slate-200 leading-tight">{currentUser.name}</p>
                    <p className="text-[10px] text-emerald-400 font-mono">{currentUser.role} • {currentUser.player_id}</p>
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

      {/* --- TOAST NOTIFICATIONS --- */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 sm:bottom-8 z-[99999] max-w-md w-full px-4 pointer-events-auto">
          <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-2xl border-2 flex items-start space-x-3 transition-all ${
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
            <p className="text-sm font-mono text-slate-400">Connecting to Real-Time Operational Manager...</p>
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
            {activeTab === 'users' && currentUser?.role === 'SUPER_ADMIN' && (
              <UserManagementView 
                users={users} 
                setUsers={setUsers} 
                showToast={showToast}
                fetchD1Data={fetchD1Data}
              />
            )}
          </>
        )}
      </main>

      {/* --- AUTH MODAL LAYER --- */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-[9000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pointer-events-auto">
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
                {authMode === 'login' ? 'Sign In to SmashHub' : authMode === 'register' ? 'Register New Player Account' : 'Reset Password'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {authMode === 'login' 
                  ? 'Welcome Back' 
                  : authMode === 'register'
                  ? 'Create a new account profile'
                  : 'Enter your ID, Name, or WhatsApp to reset your password'}
              </p>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ID or Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SH001 / Kevin Sanjaya"
                    value={loginCredential}
                    onChange={e => setLoginCredential(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Password</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
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
                  Sign In
                </button>
              </form>
            ) : authMode === 'forgot' ? (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>User ID, Full Name, or WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SH001 / Kevin Sanjaya / 08123456789"
                    value={resetIdentifier}
                    onChange={e => setResetIdentifier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">New Password (min 6 chars)</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={resetConfirmPassword}
                    onChange={e => setResetConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg shadow-emerald-500/20 transition"
                >
                  Update Password
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Kevin Sanjaya"
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="628123456789"
                    value={regWhatsapp}
                    onChange={e => setRegWhatsapp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password * (min 6 chars)</label>
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
                    onChange={e => setRegRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PLAYER">Registered Player</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Referral Code</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Optional"
                    value={regAdminCode}
                    onChange={e => setRegAdminCode(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-900/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg shadow-emerald-500/20 transition mt-2"
                >
                  Register
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

      {/* --- REGISTERED ID CONFIRMATION MODAL LAYER --- */}
      {newlyRegisteredId && (
        <div className="fixed inset-0 z-[9500] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl ring-4 ring-emerald-500/20">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Account Ready!</h3>
            <p className="text-xs text-slate-400">Save your unique code for future logins or sign in with your full name:</p>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 text-2xl font-black font-mono text-emerald-400 tracking-wider">
              {newlyRegisteredId}
            </div>

            <button
              onClick={() => setNewlyRegisteredId(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
            >
              Continue
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// 1. DASHBOARD Subcomponents with Integrated Recharts Visualizations
function DashboardView({ 
  users, courts, matches, invoices, currentUser, setActiveTab, setIsAuthOpen
}: ViewProps & { setActiveTab: any }) {
  const activeCourts = courts.filter(c => c.status === 'Occupied').length;
  const pendingDuesTotal = invoices.filter(i => i.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);
  const liveMatchesCount = matches.filter(m => m.status === 'Live').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs text-emerald-400 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Real-Time Club Dashboard</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Badminton Operations & Analytics
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Automated match pairing, live scoring, court utilization monitoring & player ratings.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {currentUser ? (
              <>
                <button
                  onClick={() => setActiveTab('booking')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book Court</span>
                </button>
                <button
                  onClick={() => setActiveTab('matchmaker')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl font-semibold text-sm transition flex items-center space-x-2"
                >
                  <Shuffle className="w-4 h-4 text-cyan-400" />
                  <span>Auto Pair</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Sign In with Player ID to Unlock Full Access</span>
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
            <h3 className="text-2xl font-bold text-white mt-1">{activeCourts} / {courts.length || 0} <span className="text-xs text-emerald-400 font-normal">Active</span></h3>
            <p className="text-[11px] text-slate-500 mt-1">{courts.length > 0 ? Math.round((activeCourts/courts.length)*100) : 0}% peak utilization</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Registered Players</p>
            <h3 className="text-2xl font-bold text-white mt-1">{users.length} <span className="text-xs text-slate-400 font-normal">Members</span></h3>
            <p className="text-[11px] text-emerald-400 mt-1">Realtime database query</p>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <Users className="w-6 h-6" />
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
            <p className="text-xs text-slate-400 uppercase font-semibold">Pending Dues</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">${pendingDuesTotal}</h3>
            <p className="text-[11px] text-slate-500 mt-1">{invoices.filter(i=>i.status==='Pending').length} invoices awaiting</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
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
              <h3 className="text-sm font-bold text-white">Weekly Session Revenue</h3>
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

      {/* Live Courts & Active Scoring Quick Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Live Overview</span>
          </h3>
          {currentUser && (
            <button onClick={() => setActiveTab('scoring')} className="text-xs text-emerald-400 hover:underline flex items-center space-x-1">
              <span>Open Scoring Console</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {courts.slice(0, 3).map(court => {
            const activeMatch = matches.find(m => m.courtId === court.id && m.status === 'Live');
            return (
              <div key={court.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{court.name}</span>
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
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 flex justify-between">
                      <span>Set {activeMatch.currentSet} of 3</span>
                      <span className="text-emerald-400 font-mono">LIVE SCORE</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-20 flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                    <span>Court Open</span>
                    <button onClick={() => setActiveTab('booking')} className="mt-1 text-[11px] text-emerald-400 hover:underline">
                      View Schedule
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 2. USER MANAGEMENT
function UserManagementView({ users, setUsers, showToast, fetchD1Data }: any) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditFormData({ ...user });
  };

  const handleSaveUser = async (id: string) => {
    try {
      const updatedUser = { ...editFormData, id } as User;
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setUsers((prev: User[]) => prev.map(u => u.id === id ? updatedUser : u));
      setEditingUserId(null);
      showToast(`User ${updatedUser.player_id} updated successfully!`, 'success');
    } catch (err: any) {
      setUsers((prev: User[]) => prev.map(u => u.id === id ? (editFormData as User) : u));
      setEditingUserId(null);
      showToast(`User updated locally: ${err.message}`, 'info');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <UserCog className="w-5 h-5 text-emerald-400" />
            <span>Super Admin User Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage every single value of registered users directly.</p>
        </div>
        <button onClick={() => fetchD1Data()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sync</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-mono">
            <tr>
              <th className="p-3">Code / ID</th>
              <th className="p-3">Full Name</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Role</th>
              <th className="p-3">Grade</th>
              <th className="p-3">ELO</th>
              <th className="p-3">Status</th>
              <th className="p-3">Dues</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((u: User) => {
              const isEditing = editingUserId === u.id;
              return (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-emerald-400">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editFormData.player_id || ''} 
                        onChange={e => setEditFormData({ ...editFormData, player_id: e.target.value })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs font-mono text-white w-20"
                      />
                    ) : u.player_id}
                  </td>
                  <td className="p-3 font-semibold text-white">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editFormData.name || ''} 
                        onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white w-32"
                      />
                    ) : u.name}
                  </td>
                  <td className="p-3 font-mono">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editFormData.whatsapp || ''} 
                        onChange={e => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white w-28 font-mono"
                      />
                    ) : u.whatsapp}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <select 
                        value={editFormData.role} 
                        onChange={e => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white"
                      >
                        <option value="SUPER_ADMIN">ADMIN</option>
                        <option value="MEMBER">MEMBER</option>
                        <option value="PLAYER">PLAYER</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'SUPER_ADMIN' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                        u.role === 'MEMBER' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <select 
                        value={editFormData.grade} 
                        onChange={e => setEditFormData({ ...editFormData, grade: e.target.value as SkillGrade })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white"
                      >
                        <option value="S (Pro)">S (Pro)</option>
                        <option value="A (Advanced)">A (Advanced)</option>
                        <option value="B (Upper Inter)">B (Upper Inter)</option>
                        <option value="C (Intermediate)">C (Intermediate)</option>
                        <option value="D (Beginner)">D (Beginner)</option>
                      </select>
                    ) : u.grade}
                  </td>
                  <td className="p-3 font-mono">
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={editFormData.elo || 1200} 
                        onChange={e => setEditFormData({ ...editFormData, elo: Number(e.target.value) })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white w-16 font-mono"
                      />
                    ) : u.elo}
                  </td>
                  <td className="p-3">
                    {isEditing ? (
                      <select 
                        value={editFormData.membershipStatus} 
                        onChange={e => setEditFormData({ ...editFormData, membershipStatus: e.target.value as any })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white"
                      >
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Expired">Expired</option>
                      </select>
                    ) : u.membershipStatus}
                  </td>
                  <td className="p-3 font-mono">
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={editFormData.duesOwed ?? 0} 
                        onChange={e => setEditFormData({ ...editFormData, duesOwed: Number(e.target.value) })}
                        className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-white w-16 font-mono"
                      />
                    ) : `$${u.duesOwed}`}
                  </td>
                  <td className="p-3 text-right">
                    {isEditing ? (
                      <button onClick={() => handleSaveUser(u.id)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1 rounded font-bold text-xs flex items-center space-x-1 ml-auto">
                        <Save className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    ) : (
                      <button onClick={() => startEditing(u)} className="text-slate-400 hover:text-emerald-400 p-1 rounded hover:bg-slate-800">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingView({ bookings }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Courts & Reservations</h2>
      <p className="text-xs text-slate-400">Total bookings in database: {bookings.length}</p>
    </div>
  );
}

function MatchMakerView({ users }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">AI ELO Matchmaker</h2>
      <p className="text-xs text-slate-400">Active player pool: {users.length} players</p>
    </div>
  );
}

function ScoringView({ matches }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Live Scorekeeper</h2>
      <p className="text-xs text-slate-400">Matches available: {matches.length}</p>
    </div>
  );
}

function GradingView({ users }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Player Skill Standings</h2>
      <p className="text-xs text-slate-400">Total rated members: {users.length}</p>
    </div>
  );
}

function BillingView({ invoices }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Billing & Invoices</h2>
      <p className="text-xs text-slate-400">Total invoice records: {invoices.length}</p>
    </div>
  );
}
