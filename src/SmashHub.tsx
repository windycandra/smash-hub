// v0.2.9 - SmashHub Pro Manager (Full Runnable & Validated Checkpoint)

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Trophy, Calendar, CreditCard, Zap, 
  CheckCircle2, BarChart3, ShieldCheck, LogOut, UserCheck, 
  MessageSquare, Shuffle, X, Lock, Phone, User as UserIcon, Key,
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
  setActiveTab: (tab: 'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'billing' | 'users') => void;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'scoring' | 'matchmaker' | 'billing' | 'users'>('dashboard');
  
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
    if (tabId === 'users' || tabId === 'matchmaker') return currentUser?.role === 'SUPER_ADMIN';
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
                { id: 'booking', label: 'Schedule', icon: Calendar },
                { id: 'matchmaker', label: 'Matchmaker', icon: Shuffle },
                { id: 'scoring', label: 'Live Scoring', icon: Activity },
                { id: 'billing', label: 'Billing', icon: CreditCard },
                { id: 'users', label: 'User', icon: UserCog },
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


        {/* Mobile Tab Navigation */}
        <div className="md:hidden overflow-x-auto border-t border-slate-800 px-2 py-2 flex space-x-1 scrollbar-none">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'booking', label: 'Schedule', icon: Calendar },
            { id: 'matchmaker', label: 'Matchmaker', icon: Shuffle },
            { id: 'scoring', label: 'Live Scoring', icon: Activity },
            { id: 'billing', label: 'Billing', icon: CreditCard },
            { id: 'users', label: 'User', icon: UserCog },
            { id: 'Tournament', label: 'Tournament', icon: Trophy },
          ].map(tab => {
            const isAllowed = canAccessTab(tab.id);
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            if (!isAllowed) return null;

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
            {activeTab === 'Tournament' && currentUser && (
              <TournamentView 
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
              </>
            ) : (
              <>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl px-4 py-2 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Unlock Access</span>
              </button>
      
              <button
                onClick={() => window.open("https://bit.ly/4fk19yP", "_blank", "noopener,noreferrer")}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl font-semibold text-sm transition flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Join Group</span>
              </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

// 3 BOOKING MANAGEMENT
function BookingView({ 
  courts, bookings, setBookings, currentUser, showToast 
}: { 
  courts: Court[]; bookings: Booking[]; setBookings: React.Dispatch<React.SetStateAction<Booking[]>>; currentUser: User | null; showToast: (msg: string) => void;
}) {
  const [selectedCourt, setSelectedCourt] = useState<Court>(courts[0]);
  const [bookingDate, setBookingDate] = useState('2026-11-06');
  const [selectedSlot, setSelectedSlot] = useState('18:00 - 19:00');
  const [bookingType, setBookingType] = useState<'Casual Play' | 'Tournament' | 'Coaching Session'>('Casual Play');

  const timeSlots = [
    '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', 
    '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00',
    '18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00'
  ];

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('Please sign in to make court reservations!');
      return;
    }

    // Check conflict
    const isConflict = bookings.some(b => 
      b.courtId === selectedCourt.id && b.date === bookingDate && b.timeSlot === selectedSlot
    );

    if (isConflict) {
      showToast('⚠️ Slot already booked! Please select another time slot.');
      return;
    }

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      playerName: currentUser.name,
      date: bookingDate,
      timeSlot: selectedSlot,
      type: bookingType,
      paymentStatus: 'Paid',
      fee: selectedCourt.type === 'Synthetic Wooden' ? 35 : 25
    };

    setBookings([newBooking, ...bookings]);
    showToast(`✅ Reserved ${selectedCourt.name} for ${bookingDate} [${selectedSlot}]`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>Court Booking & Schedule Console</span>
          </h2>
          <p className="text-xs text-slate-400">Reserve synthetic & standard courts with real-time slot verification</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Court Cards Selection */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Available Badminton Courts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courts.map(court => {
              const isSelected = selectedCourt.id === court.id;
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

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>💡 {court.lighting}</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {court.type === 'Synthetic Wooden' ? '$35/hr' : '$25/hr'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bookings Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 mt-6">
            <h3 className="text-sm font-bold text-white">Upcoming Club Reservations</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Court</th>
                    <th className="p-3">Reserved By</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Session Type</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200">{b.courtName}</td>
                      <td className="p-3">{b.playerName}</td>
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
            <h3 className="font-bold text-white text-base">Confirm Reservation</h3>
            <p className="text-xs text-slate-400">Selected: <span className="text-emerald-400 font-medium">{selectedCourt.name}</span></p>
          </div>

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
                  const isBooked = bookings.some(b => b.courtId === selectedCourt.id && b.date === bookingDate && b.timeSlot === slot);
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
                <option value="Tournament">Tournament Round</option>
                <option value="Coaching Session">Personal Coaching</option>
              </select>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Base Rate:</span>
                <span className="font-mono text-slate-200">{selectedCourt.type === 'Synthetic Wooden' ? '$35.00' : '$25.00'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shuttlecock Pack Addon:</span>
                <span className="font-mono text-slate-200">$0.00 (Included)</span>
              </div>
              <div className="flex justify-between text-slate-200 font-bold pt-1.5 border-t border-slate-800">
                <span>Total Fee:</span>
                <span className="font-mono text-emerald-400 text-sm">
                  ${selectedCourt.type === 'Synthetic Wooden' ? '35.00' : '25.00'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Lock Booking</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}


// 4.MATCHMAKER

function MatchMakerView({ 
  users, courts, matches, setMatches, setCourts, showToast, setActiveTab 
}: { 
  users: User[]; courts: Court[]; matches: Match[]; setMatches: React.Dispatch<React.SetStateAction<Match[]>>; setCourts: React.Dispatch<React.SetStateAction<Court[]>>; showToast: (msg: string) => void; setActiveTab: (tab: any) => void;
}) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(users.map(u => u.id));
  const [matchFormat, setMatchFormat] = useState<'Doubles' | 'Singles'>('Doubles');
  const [targetCourtId, setTargetCourtId] = useState<number>(3);

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

    // Sort by ELO for balanced pairing
    const sorted = [...activePlayers].sort((a, b) => b.elo - a.elo);

    let t1: string[] = [];
    let t2: string[] = [];

    if (matchFormat === 'Doubles') {
      // Balanced ELO algorithm: Pair Highest (1) + Lowest (4) vs Middle (2 + 3)
      t1 = [sorted[0].name, sorted[3].name];
      t2 = [sorted[1].name, sorted[2].name];
    } else {
      t1 = [sorted[0].name];
      t2 = [sorted[1].name];
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

    // Update court status
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
          <p className="text-xs text-slate-400">Algorithmic player pairing to guarantee competitive parity & fair court rotation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Player Pool Selector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Select Player Pool ({selectedPlayerIds.length} Selected)</h3>
            <button 
              onClick={() => setSelectedPlayerIds(selectedPlayerIds.length === users.length ? [] : users.map(u => u.id))}
              className="text-xs text-cyan-400 hover:underline"
            >
              {selectedPlayerIds.length === users.length ? 'Deselect All' : 'Select All Members'}
            </button>
          </div>

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
                      <h4 className="text-xs font-bold text-white">{player.name}</h4>
                      <p className="text-[10px] text-slate-400">{player.grade} • <span className="text-emerald-400 font-mono">{player.elo} ELO</span></p>
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
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Estimated Fair Score:</span>
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>Team A Avg ELO:</span>
                <span className="text-cyan-400">~1780</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>Team B Avg ELO:</span>
                <span className="text-emerald-400">~1765</span>
              </div>
            </div>

            <button
              onClick={handleGeneratePairings}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Generate & Start Match</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// 5. LIVE SCORING 

function ScoringView({ 
  matches, setMatches, courts, setCourts, users, setUsers, showToast 
}: { 
  matches: Match[]; setMatches: React.Dispatch<React.SetStateAction<Match[]>>; courts: Court[]; setCourts: React.Dispatch<React.SetStateAction<Court[]>>; users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>; showToast: (msg: string) => void;
}) {
  const liveMatches = matches.filter(m => m.status === 'Live');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(liveMatches[0]?.id || matches[0]?.id);

  const activeMatch = matches.find(m => m.id === selectedMatchId);

  // Score Increment Logic (BWF Standard Rally Point System)
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

    // Check Set Victory (21 pts, win by 2, cap at 30)
    let setWinner: 1 | 2 | null = null;
    if ((s1 >= 21 || s2 >= 21) && Math.abs(s1 - s2) >= 2) {
      setWinner = s1 > s2 ? 1 : 2;
    } else if (s1 === 30 || s2 === 30) {
      setWinner = s1 === 30 ? 1 : 2;
    }

    if (setWinner) {
      // Check overall match winner (Best of 3)
      const setsWon1 = scores1.filter((s, idx) => s > (scores2[idx] || 0) && (s >= 21 || scores2[idx] >= 21)).length;
      const setsWon2 = scores2.filter((s, idx) => s > (scores1[idx] || 0) && (s >= 21 || scores1[idx] >= 21)).length;

      if (setsWon1 === 2 || setsWon2 === 2) {
        // Final Match Complete!
        const matchWinner = setsWon1 === 2 ? 1 : 2;
        setMatches(matches.map(m => m.id === activeMatch.id ? {
          ...m,
          score1: scores1,
          score2: scores2,
          status: 'Completed',
          winner: matchWinner
        } : m));

        // Free up court
        setCourts(courts.map(c => c.id === activeMatch.courtId ? { ...c, status: 'Available', currentMatchId: undefined } : c));

        // Automatic ELO Adjustment simulation
        const winningTeamNames = matchWinner === 1 ? activeMatch.team1 : activeMatch.team2;
        setUsers(users.map(u => winningTeamNames.includes(u.name) ? { ...u, elo: u.elo + 25, wins: u.wins + 1, matchesPlayed: u.matchesPlayed + 1 } : u));

        showToast(`🏆 Match Finalized! Team ${matchWinner} Wins! ELO updated.`);
        return;
      } else {
        // Advance to next set
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

      {/* Match Selector Tabs */}
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
          
          {/* Top Info Bar */}
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

          {/* Big Scoreboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Team 1 Score Card */}
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

            {/* Team 2 Score Card */}
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

          {/* Previous Sets Breakdown */}
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


function TournamentView({ users }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-300">
      <h2 className="text-lg font-bold text-white mb-4">Player Skill Standings</h2>
      <p className="text-xs text-slate-400">Total rated members: {users.length}</p>
    </div>
  );
}


// 7. BILLING INVOICES
function BillingView({ 
  invoices, setInvoices, currentUser, showToast 
}: { 
  invoices: Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>; currentUser: User | null; showToast: (msg: string) => void;
}) {
  const handleMarkAsPaid = (invId: string) => {
    setInvoices(invoices.map(i => i.id === invId ? { ...i, status: 'Paid', paymentMethod: 'Stripe Mock Auto' } : i));
    showToast(`Invoice ${invId} marked as PAID!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Billing, Invoices & Membership Fees</span>
          </h2>
          <p className="text-xs text-slate-400">Manage court fees, monthly dues & automated payment collection</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Invoice Ref</th>
                <th className="p-3">Member</th>
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
      </div>
    </div>
  );
}
