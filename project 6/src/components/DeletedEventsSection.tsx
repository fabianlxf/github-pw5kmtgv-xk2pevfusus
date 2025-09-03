import React from 'react';
import { RotateCcw, Trash2, Clock } from 'lucide-react';
import { DeletedEvent } from '../types';

interface DeletedEventsSectionProps {
  deletedEvents: DeletedEvent[];
  onRestore: (eventId: string) => void;
  isDarkMode: boolean;
}

export const DeletedEventsSection: React.FC<DeletedEventsSectionProps> = ({
  deletedEvents,
  onRestore,
  isDarkMode
}) => {
  const formatDeletedDate = (deletedAt: string) => {
    const date = new Date(deletedAt);
    return date.toLocaleDateString('de-DE', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`rounded-2xl p-4 mb-6 border ${
      isDarkMode ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className={`w-5 h-5 ${
          isDarkMode ? 'text-red-400' : 'text-red-600'
        }`} />
        <h3 className={`font-semibold ${
          isDarkMode ? 'text-red-400' : 'text-red-700'
        }`}>
          Gelöschte Events ({deletedEvents.length})
        </h3>
      </div>
      
      <div className="space-y-3">
        {deletedEvents.map(({ event, deletedAt }) => (
          <div
            key={event.id}
            className={`rounded-xl p-3 border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                : 'bg-white border-gray-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm mb-1 ${
                  isDarkMode ? 'text-white/80' : 'text-gray-700'
                }`}>
                  {event.title}
                </div>
                <div className={`flex items-center gap-2 text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <Clock className="w-3 h-3" />
                  <span>{event.time}</span>
                  <span>•</span>
                  <span>Gelöscht: {formatDeletedDate(deletedAt)}</span>
                </div>
              </div>
              
              <button
                onClick={() => onRestore(event.id)}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400' 
                    : 'bg-green-100 hover:bg-green-200 text-green-600'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};