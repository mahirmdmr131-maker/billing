
import React from 'react';
import { BusinessInfo } from '../types';

interface SplashScreenProps {
  business: BusinessInfo | null;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ business }) => {
  return (
    <div className="fixed inset-0 bg-indigo-950 flex flex-col items-center justify-center text-white p-6 transition-opacity duration-1000 z-[200]">
      {/* Immersive Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Zoom Animation Container */}
        <div className="animate-logo-entry mb-12 relative">
          {business?.logo ? (
            <div className="relative">
              {/* Logo Glow Effect */}
              <div className="absolute inset-0 bg-indigo-500/30 blur-3xl rounded-full scale-125 animate-pulse"></div>
              <img 
                src={business.logo} 
                alt="Business Logo" 
                className="w-48 h-48 rounded-[56px] border-4 border-white/20 shadow-[0_30px_70px_rgba(0,0,0,0.6)] bg-white p-6 object-contain relative z-10" 
              />
            </div>
          ) : (
            <div className="w-36 h-36 bg-white/10 rounded-[48px] flex items-center justify-center text-6xl font-black shadow-[0_25px_60px_rgba(0,0,0,0.4)] border-2 border-white/20 backdrop-blur-md">
              AM
            </div>
          )}
        </div>

        {/* Text Fade-In Animation */}
        <div className="text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-indigo-200">
            {business?.name || "A M Food Processing"}
          </h1>
          <div className="h-1.5 w-20 bg-indigo-500 mx-auto rounded-full mb-6 shadow-[0_0_20px_rgba(99,102,241,0.6)]"></div>
          <p className="text-indigo-300 text-[10px] md:text-xs font-black tracking-[0.6em] uppercase opacity-70">
            {business?.tagline || "Quality Processing Suite"}
          </p>
        </div>
      </div>
      
      {/* Bottom Loading Indicator */}
      <div className="absolute bottom-20 flex flex-col items-center opacity-0 animate-fade-in" style={{ animationDelay: '1s' }}>
        <div className="w-56 h-1 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/5">
          <div className="h-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-loading-slide w-full"></div>
        </div>
        <span className="text-[9px] text-indigo-400/60 font-black uppercase tracking-[0.4em]">Initialising Environment</span>
      </div>

      <style>{`
        @keyframes logo-entry {
          0% { transform: scale(0.2); opacity: 0; filter: blur(30px); }
          65% { transform: scale(1.08); opacity: 1; filter: blur(0px); }
          100% { transform: scale(1); opacity: 1; filter: blur(0px); }
        }
        @keyframes fade-in-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-logo-entry {
          animation: logo-entry 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
        .animate-loading-slide {
          animation: loading-slide 2.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
