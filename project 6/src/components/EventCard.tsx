import React, { useState } from 'react';
import { Check, Clock, Trash2, MoreVertical } from 'lucide-react';
import { PlanEvent } from '../types';

interface EventCardProps {
  event: PlanEvent;
  onToggle: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  isDarkMode: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onToggle,
  onDelete,
  isDarkMode
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
      event.completed 
        ? (isDarkMode ? 'bg-green-900/30 border-green-500/30' : 'bg-green-100 border-green-300')
        : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:shadow-lg')
    } border backdrop-blur-md hover:scale-[1.02]`}>
      <div className="flex items-start gap-4">
        {/* Completion Toggle */}
        <button
          onClick={() => onToggle(event.id)}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 mt-1 ${
            event.completed
              ? 'bg-green-500 border-green-500 text-white'
              : (isDarkMode ? 'border-white/30 hover:border-white/60' : 'border-gray-300 hover:border-gray-500')
          }`}
        >
          {event.completed && <Check className="w-4 h-4" />}
        </button>
        
        {/* Event Content */}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-base mb-1 ${
            event.completed 
              ? (isDarkMode ? 'text-green-300 line-through' : 'text-green-700 line-through')
              : (isDarkMode ? 'text-white' : 'text-gray-900')
          }`}>
            {event.title}
          </div>
          
          <div className={`flex items-center gap-2 text-sm mb-2 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{event.time}</span>
          </div>
          
          {event.description && (
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            } line-clamp-2`}>
              {event.description}
            </p>
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className={`p-2 rounded-xl transition-all duration-300 ${
              isDarkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showActions && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowActions(false)}
              />
              
              {/* Menu */}
              <div className={`absolute right-0 top-full mt-2 z-20 rounded-xl border shadow-lg overflow-hidden ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <button
                  onClick={() => {
                    onDelete(event.id);
                    setShowActions(false);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-2 transition-colors ${
                    isDarkMode ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};