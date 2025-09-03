import React from 'react';
import { Goal } from '../types';
import { GoalCard } from './GoalCard';
import { Brain, Target, Settings, Moon, Sun } from 'lucide-react';

interface DashboardProps {
  goals: Goal[];
  onEditGoal: (goal: Goal) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  goals, 
  onEditGoal,
  isDarkMode,
  onToggleTheme
}) => {
  const totalProgress = goals.length > 0 
    ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
    : 0;

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Brain className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />
          <div>
            <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>BrainFocus</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode 
                ? 'hover:bg-white/10 text-white' 
                : 'hover:bg-gray-900/10 text-gray-900'
            }`}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Moon className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
          <Settings className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />
        </div>
      </div>

      {/* Statistics - Horizontal Layout */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Main Progress Card */}
        <div className={`col-span-3 rounded-3xl p-6 border ${
          isDarkMode 
            ? 'bg-black border-white/10' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalProgress}%</div>
              <div className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Average Progress</div>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className={isDarkMode ? 'text-gray-700' : 'text-gray-300'}
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${totalProgress * 1.76} 176`}
                  className={isDarkMode ? 'text-white' : 'text-gray-900'}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Target className={`w-4 h-4 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>

        {/* Small Stats Cards */}
        <div className={`rounded-3xl p-4 border ${
          isDarkMode 
            ? 'bg-black border-white/10' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{goals.length}</div>
          <div className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Active Goals</div>
          <div className="mt-3 relative w-8 h-8">
            <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray="20 75"
                className="text-red-400"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-1 bg-red-400 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className={`${isDarkMode ? 'bg-black' : 'bg-white'} rounded-3xl p-4 ${isDarkMode ? 'border border-white/10' : 'border border-black/10'}`}>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>89</div>
          <div className={`${isDarkMode ? 'text-white/70' : 'text-gray-600'} text-xs`}>Insights Read</div>
          <div className="mt-3 relative w-8 h-8">
            <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray="35 75"
                className="text-orange-400"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className={`${isDarkMode ? 'bg-black' : 'bg-white'} rounded-3xl p-4 ${isDarkMode ? 'border border-white/10' : 'border border-black/10'}`}>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>48</div>
          <div className={`${isDarkMode ? 'text-white/70' : 'text-gray-600'} text-xs`}>Focus Hours</div>
          <div className="mt-3 relative w-8 h-8">
            <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray="25 75"
                className="text-blue-400"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Goals Section */}
      <div className="mb-6">
        <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Your Goals</h2>

        {goals.length === 0 ? (
          <div className={`${isDarkMode ? 'bg-black' : 'bg-white'} rounded-3xl p-8 text-center ${isDarkMode ? 'border border-white/10' : 'border border-black/10'}`}>
            <div className={`p-4 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'} rounded-3xl w-16 h-16 mx-auto mb-4 flex items-center justify-center`}>
              <Target className={`w-8 h-8 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`} strokeWidth={1.5} />
            </div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>No goals yet</h3>
            <p className={`${isDarkMode ? 'text-white/70' : 'text-gray-600'} mb-6`}>Create your first goal to start receiving AI-powered insights.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={onEditGoal}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};