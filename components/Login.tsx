
import React, { useState } from 'react';
import { AppData, User } from '../types';

interface LoginProps {
  data: AppData;
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ data, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = data.users.find(u => u.username === username && u.passwordHash === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-700 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <div className="bg-indigo-600 p-10 text-white text-center">
          {data.business?.logo ? (
            <img src={data.business.logo} alt="Logo" className="w-20 h-20 mx-auto mb-4 bg-white p-2 rounded-2xl object-contain" />
          ) : (
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-4">AM</div>
          )}
          <h2 className="text-2xl font-black uppercase tracking-tight">{data.business?.name || 'A M Food Processing'}</h2>
          <p className="text-indigo-100 opacity-80 mt-1 text-sm">Secure Business Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-10 space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 animate-pulse">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
            <input
              type="text" required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. admin"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
            <input
              type="password" required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <span>Log In to System</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
          </button>
          
          <div className="text-center">
            <button 
              type="button" 
              onClick={() => setShowForgotModal(true)}
              className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors border-b border-transparent hover:border-indigo-600 pb-0.5"
            >
              Forgot Password?
            </button>
          </div>
        </form>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Access Recovery</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">A M Food Processing Security</p>
            
            <div className="space-y-4 text-sm text-slate-600 leading-relaxed font-medium">
              <p>For security and privacy, all account credentials are stored locally on this workstation and cannot be recovered automatically.</p>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left space-y-4">
                <p className="font-bold text-slate-800 text-xs uppercase tracking-widest text-indigo-600">Administrative Help:</p>
                <p className="text-xs">Please contact the manager of <span className="font-bold">{data.business?.name || 'A M Food Processing'}</span> to reset your access or provide a new password.</p>
                
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Primary Contact:</p>
                  <div className="flex flex-col space-y-3">
                    <p className="text-lg font-black text-slate-800">📞 {data.business?.phone || 'Contact Admin'}</p>
                    <a 
                      href={`tel:${data.business?.phone}`}
                      className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95 text-xs uppercase tracking-widest"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1.01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span>Call Now</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowForgotModal(false)}
              className="w-full mt-6 py-4 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
