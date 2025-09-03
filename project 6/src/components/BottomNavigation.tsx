import React from 'react';
import { Home, BarChart3, Plus } from 'lucide-react';

interface BottomNavigationProps {
  currentPage: 'home' | 'insights';
  onPageChange: (page: 'home' | 'insights') => void;
  onCreateGoal: () => void;
  isDarkMode: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentPage,
  onPageChange,
  onCreateGoal,
  isDarkMode
}) => {
  return (
    <>
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className={`${isDarkMode ? 'bg-black border-white/10' : 'bg-white border-black/10'} border-t px-4 py-2`}>
          <div className="flex items-center justify-around max-w-md mx-auto">
            <button
              onClick={() => onPageChange('home')}
              className={`flex flex-col items-center space-y-1 py-3 px-6 ${
                currentPage === 'home' 
                  ? (isDarkMode ? 'text-white' : 'text-gray-900') 
                  : (isDarkMode ? 'text-white/60' : 'text-gray-600')
              }`}
            >
              <Home className="w-6 h-6" strokeWidth={1} />
              <span className="text-xs font-medium">Home</span>
            </button>

            <button
              onClick={() => onPageChange('insights')}
              className={`flex flex-col items-center space-y-1 py-3 px-6 ${
                currentPage === 'insights' 
                  ? (isDarkMode ? 'text-white' : 'text-gray-900') 
                  : (isDarkMode ? 'text-white/60' : 'text-gray-600')
              }`}
            >
              <BarChart3 className="w-6 h-6" strokeWidth={1} />
              <span className="text-xs font-medium">Insights</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Plus Button */}
      <button
        onClick={onCreateGoal}
        className={`fixed bottom-20 right-6 z-50 w-14 h-14 ${isDarkMode ? 'bg-white' : 'bg-black'} rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform md:bottom-6`}
      >
        <Plus className={`w-7 h-7 ${isDarkMode ? 'text-gray-900' : 'text-white'}`} strokeWidth={1.5} />
      </button>
    </>
  );
};