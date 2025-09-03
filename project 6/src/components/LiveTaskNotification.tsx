import React, { useEffect, useState } from 'react';
import { Check, Clock, Flame } from 'lucide-react';
import { PlanEvent } from './FlameDashboard';

interface LiveTaskNotificationProps {
  liveTask: PlanEvent | null;
  onComplete: (eventId: string) => void;
  isDarkMode: boolean;
}

export const LiveTaskNotification: React.FC<LiveTaskNotificationProps> = ({
  liveTask,
  onComplete,
  isDarkMode
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (liveTask) {
      setIsVisible(true);
      
      // Calculate time remaining
      const updateTimeRemaining = () => {
        const now = new Date();
        const eventTime = new Date(`${now.toDateString()} ${liveTask.time}`);
        const diffMs = eventTime.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        
        if (diffMinutes > 0) {
          setTimeRemaining(`in ${diffMinutes} Min`);
        } else if (diffMinutes === 0) {
          setTimeRemaining('JETZT');
        } else {
          setTimeRemaining(`${Math.abs(diffMinutes)} Min überfällig`);
        }
      };
      
      updateTimeRemaining();
      const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
      
      return () => clearInterval(interval);
    } else {
      setIsVisible(false);
    }
  }, [liveTask]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Show persistent notification for live task
    if (liveTask && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`🔴 LIVE: ${liveTask.title}`, {
        body: `${liveTask.time} • Jetzt aktiv`,
        icon: '/icon-192.png',
        tag: 'live-task', // This ensures only one notification at a time
        requireInteraction: true, // Makes it persistent (can't be auto-dismissed)
        silent: false
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      return () => {
        notification.close();
      };
    }
  }, [liveTask]);

  if (!isVisible || !liveTask) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
      <div className={`rounded-2xl p-4 border-2 border-green-400/50 bg-green-500/20 backdrop-blur-md shadow-2xl ${
        isDarkMode ? 'bg-green-900/40' : 'bg-green-100/90'
      }`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-green-500/30 flex items-center justify-center animate-pulse">
              <Flame className="w-6 h-6 text-green-400 animate-bounce" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-bold text-sm animate-pulse">🔴 LIVE</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                isDarkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-200 text-green-700'
              }`}>
                {timeRemaining}
              </span>
            </div>
            <div className={`font-bold text-lg mb-1 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {liveTask.title}
            </div>
            <div className={`flex items-center gap-2 text-sm ${
              isDarkMode ? 'text-green-300' : 'text-green-700'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{liveTask.time}</span>
              {liveTask.reminderMinutes && liveTask.reminderMinutes > 0 && (
                <span className="text-xs opacity-70">
                  • 🔔 {liveTask.reminderMinutes}min Erinnerung
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={() => onComplete(liveTask.id)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-down {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
`;
document.head.appendChild(style);