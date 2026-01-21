
import React from 'react';
import { BusinessInfo } from '../types';

interface SplashScreenProps {
  business: BusinessInfo | null;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ business }) => {
  return (
    <div className="fixed inset-0 bg-indigo-900 flex flex-col items-center justify-center text-white p-6 transition-opacity duration-1000">
      <div className="animate-bounce mb-8">
        {business?.logo ? (
          <img src={business.logo} alt="Business Logo" className="w-32 h-32 rounded-3xl border-4 border-white shadow-2xl bg-white p-2 object-contain" />
        ) : (
          <div className="w-32 h-32 bg-white/20 rounded-3xl flex items-center justify-center text-6xl font-bold shadow-2xl border-2 border-white/30">
            A M
          </div>
        )}
      </div>
      <h1 className="text-4xl font-bold mb-2 text-center tracking-tight">
        {business?.name || "A M Food Processing"}
      </h1>
      <p className="text-indigo-200 text-lg font-light tracking-widest uppercase">
        {business?.tagline || "Quality Processing Solutions"}
      </p>
      
      <div className="absolute bottom-12 flex flex-col items-center">
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-white animate-[loading_2s_ease-in-out_infinite] w-1/3 rounded-full"></div>
        </div>
        <span className="text-sm text-indigo-300 font-medium">Loading Management Suite</span>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
