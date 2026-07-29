
import React, { useState, useEffect } from 'react';
import { AppData, User } from '../types';
import { sendOTP, generateOTP } from '../utils/otp';
import { createAuditLog } from '../utils/rbac';

interface LoginProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ data, updateData, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'username' | 'staffInfo' | 'adminCode' | 'adminSuccess' | 'otpRequest' | 'otpVerify' | 'newPassword'>('username');
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [otpToast, setOtpToast] = useState<{phone: string, code: string} | null>(null);

  useEffect(() => {
    const handleOtpSent = (e: any) => {
      setOtpToast(e.detail);
      setTimeout(() => setOtpToast(null), 10000);
    };
    window.addEventListener('otp-sent', handleOtpSent);
    return () => window.removeEventListener('otp-sent', handleOtpSent);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = data.users.find(u => u.username === username && u.passwordHash === password);
    if (user) {
      if (user.isLocked) {
        setError('Your account is locked. Please contact a Super Administrator.');
        return;
      }
      if (user.isActive === false) {
        setError('Your account is disabled. Please contact your manager or administrator.');
        return;
      }

      const updatedUser: User = {
        ...user,
        lastLogin: new Date().toISOString(),
      };

      updateData(prev => {
        const log = createAuditLog(updatedUser, 'User Login', 'Auth', `User ${updatedUser.username} logged in successfully`);
        return {
          ...prev,
          users: prev.users.map(u => u.id === user.id ? updatedUser : u),
          auditLogs: [log, ...(prev.auditLogs || [])]
        };
      });

      onLogin(updatedUser);
    } else {
      setError('Invalid username or password');
    }
  };

  const handleForgotClick = () => {
    setRecoveryUsername(username); // Pre-fill from login input
    setRecoveryStep('username');
    setShowForgotModal(true);
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = data.users.find(u => u.username.toLowerCase() === recoveryUsername.toLowerCase());
    if (!user) {
      alert('Username not found in system.');
      return;
    }
    
    setTargetUser(user);
    
    if (user.phone) {
      setRecoveryStep('otpRequest');
    } else if (user.role === 'admin') {
      setRecoveryStep('adminCode');
    } else {
      setRecoveryStep('staffInfo');
    }
  };

  const handleRequestOTP = async () => {
    if (!targetUser?.phone) return;
    setIsSendingOtp(true);
    const code = generateOTP();
    setOtpCode(code);
    await sendOTP(targetUser.phone, code);
    setIsSendingOtp(false);
    setRecoveryStep('otpVerify');
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput === otpCode) {
      setRecoveryStep('newPassword');
    } else {
      alert('Invalid OTP code. Please try again.');
    }
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      alert('Password must be at least 4 characters.');
      return;
    }
    
    updateData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === targetUser?.id ? { ...u, passwordHash: newPassword } : u)
    }));
    setRecoveryStep('adminSuccess');
  };

  const handleAdminRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryCodeInput === data.adminRecoveryCode) {
      if (newAdminPassword.length < 4) {
        alert('Password must be at least 4 characters.');
        return;
      }
      // Reset admin password
      updateData(prev => ({
        ...prev,
        users: prev.users.map(u => u.role === 'admin' ? { ...u, passwordHash: newAdminPassword } : u)
      }));
      setRecoveryStep('adminSuccess');
    } else {
      alert('Incorrect Recovery Code.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Aesthetic Background Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[150px] opacity-20 -mr-40 -mt-40"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600 rounded-full blur-[150px] opacity-10 -ml-40 -mb-40"></div>

      {/* OTP Toast Notification (Demo Only) */}
      {otpToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl border border-white/10 animate-in slide-in-from-top-8 duration-500 flex items-center space-x-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl">📱</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">OTP Sent to {otpToast.phone}</p>
            <p className="text-xl font-black tracking-[0.2em] text-indigo-400">{otpToast.code}</p>
          </div>
          <button onClick={() => setOtpToast(null)} className="text-slate-500 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="max-w-md w-full bg-white/90 backdrop-blur-2xl rounded-[50px] shadow-2xl overflow-hidden border border-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-10">
        <div className="bg-indigo-600 p-12 text-white text-center">
          {data.business?.logo ? (
            <img src={data.business.logo} alt="Logo" className="w-24 h-24 mx-auto mb-6 bg-white p-3 rounded-[32px] object-contain shadow-2xl" />
          ) : (
            <div className="w-20 h-20 bg-white/20 rounded-[32px] flex items-center justify-center text-4xl font-black mx-auto mb-6 backdrop-blur-md">AM</div>
          )}
          <h2 className="text-2xl font-black uppercase tracking-tight">{data.business?.name || 'A M Food Processing'}</h2>
          <p className="text-indigo-100 opacity-60 mt-1 text-xs font-black uppercase tracking-widest">Business Management Suite</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-12 space-y-8">
          {error && <div className="p-4 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-rose-100 animate-pulse text-center">{error}</div>}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Username ID</label>
            <input
              type="text" required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-700"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin or staff_name"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Access Key</label>
            <input
              type="password" required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-bold text-slate-700"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-[24px] shadow-2xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center space-x-3 text-sm uppercase tracking-widest"
          >
            <span>Authorize Session</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
          
          <div className="text-center space-y-4 pt-4 border-t border-slate-50">
            <button 
              type="button" 
              onClick={handleForgotClick}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-indigo-600 transition-colors"
            >
              Forgot Access Credentials?
            </button>
            <div className="flex items-center justify-center space-x-4 px-12">
              <div className="h-px bg-slate-100 flex-1"></div>
              <span className="text-[8px] font-black text-slate-200 uppercase tracking-widest">OR</span>
              <div className="h-px bg-slate-100 flex-1"></div>
            </div>
            <button 
              type="button" 
              onClick={() => {
                setRecoveryStep('adminCode');
                setShowForgotModal(true);
              }}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center space-x-2 mx-auto"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              <span>Use Admin Recovery Code</span>
            </button>
          </div>
        </form>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[50px] shadow-2xl p-12 animate-in zoom-in-95 duration-200 relative overflow-hidden">
            
            {recoveryStep === 'username' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Identify Account</h3>
                <form onSubmit={handleUsernameSubmit} className="space-y-4">
                   <input 
                     type="text" required
                     placeholder="Enter your username"
                     className="w-full px-6 py-4 bg-slate-50 border rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-center"
                     value={recoveryUsername}
                     onChange={e => setRecoveryUsername(e.target.value)}
                   />
                   <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-3xl uppercase text-xs tracking-widest">Verify Identity</button>
                </form>
              </div>
            )}

            {recoveryStep === 'otpRequest' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">OTP Verification</h3>
                <p className="text-sm text-slate-500 font-medium">We will send a 6-digit code to your registered mobile number:</p>
                <div className="bg-slate-50 p-4 rounded-2xl font-black text-indigo-600 tracking-widest">
                  {targetUser?.phone?.replace(/.(?=.{4})/g, '*')}
                </div>
                <button 
                  onClick={handleRequestOTP}
                  disabled={isSendingOtp}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-3xl uppercase text-xs tracking-widest flex items-center justify-center space-x-2"
                >
                  {isSendingOtp ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Send OTP Code</span>
                  )}
                </button>
              </div>
            )}

            {recoveryStep === 'otpVerify' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Enter Code</h3>
                <p className="text-xs text-slate-400 font-bold">Check your phone for the 6-digit verification code.</p>
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                   <input 
                     type="text" required
                     maxLength={6}
                     placeholder="000000"
                     className="w-full px-6 py-4 bg-slate-50 border rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-black text-center text-2xl tracking-[0.5em]"
                     value={otpInput}
                     onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                   />
                   <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-3xl uppercase text-xs tracking-widest">Verify Code</button>
                   <button type="button" onClick={handleRequestOTP} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600">Resend Code</button>
                </form>
              </div>
            )}

            {recoveryStep === 'newPassword' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">New Password</h3>
                <form onSubmit={handlePasswordReset} className="space-y-4">
                   <input 
                     type="password" required
                     placeholder="Enter new password"
                     className="w-full px-6 py-4 bg-slate-50 border rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-center"
                     value={newPassword}
                     onChange={e => setNewPassword(e.target.value)}
                   />
                   <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-3xl uppercase text-xs tracking-widest">Reset Password</button>
                </form>
              </div>
            )}

            {recoveryStep === 'staffInfo' && (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Staff Recovery</h3>
                <div className="space-y-4 text-slate-600 leading-relaxed font-medium">
                  <p className="text-sm">Access for <b>{recoveryUsername}</b> is locked. For security, please contact the System Administrator to reset your password.</p>
                  <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Business Contact</p>
                    <p className="text-2xl font-black text-indigo-600">📞 {data.business?.phone || 'Not Set'}</p>
                    <a 
                      href={`tel:${data.business?.phone}`}
                      className="inline-flex w-full items-center justify-center space-x-3 py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1.01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span>Request Reset</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {recoveryStep === 'adminCode' && (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 20a10.003 10.003 0 006.239-2.239l.042.048m-4.588-4.41l-.456-.446a3 3 0 010-4.242 3 3 0 014.243 0l.456.446m-9.172 0l.456.446a3 3 0 010 4.242 3 3 0 01-4.243 0l-.456-.446m12.728 0l-.456-.446a3 3 0 010-4.242 3 3 0 014.243 0l.456.446" /></svg>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Admin Override</h3>
                <p className="text-xs text-slate-400 font-bold">Verify your secret Recovery Code to unlock the master account.</p>
                <form onSubmit={handleAdminRecovery} className="space-y-4">
                   <input 
                     type="text" required
                     placeholder="Enter Recovery Code"
                     className="w-full px-6 py-4 bg-rose-50 border-2 border-rose-100 rounded-3xl outline-none focus:ring-4 focus:ring-rose-500/10 font-black text-center text-rose-600"
                     value={recoveryCodeInput}
                     onChange={e => setRecoveryCodeInput(e.target.value)}
                   />
                   <input 
                     type="password" required
                     placeholder="New Admin Password"
                     className="w-full px-6 py-4 bg-slate-50 border rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-center"
                     value={newAdminPassword}
                     onChange={e => setNewAdminPassword(e.target.value)}
                   />
                   <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-xl uppercase text-xs tracking-widest">Update Master Key</button>
                </form>
              </div>
            )}

            {recoveryStep === 'adminSuccess' && (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Key Updated</h3>
                <p className="text-sm text-slate-500 font-medium">Master account access has been restored. You can now log in with your new password.</p>
                <button 
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-3xl uppercase text-xs tracking-widest"
                >
                  Return to Login
                </button>
              </div>
            )}
            
            {recoveryStep !== 'adminSuccess' && (
              <button 
                onClick={() => setShowForgotModal(false)}
                className="w-full mt-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600"
              >
                Cancel & Return
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
