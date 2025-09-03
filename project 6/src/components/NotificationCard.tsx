import React from 'react';
import { Notification, NotificationType } from '../types';
import { Brain, BookOpen, TrendingUp, Lightbulb, Clock } from 'lucide-react';

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  isDarkMode: boolean;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ 
  notification, 
  onMarkAsRead,
  isDarkMode
}) => {
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'insight':
        return <Brain className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />;
      case 'suggestion':
        return <Lightbulb className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />;
      case 'reminder':
        return <Clock className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />;
      case 'milestone':
        return <TrendingUp className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />;
      default:
        return <BookOpen className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} strokeWidth={1} />;
    }
  };

  return (
    <div className={`${isDarkMode ? 'bg-black' : 'bg-white'} rounded-3xl p-4 ${isDarkMode ? 'border border-white/10' : 'border border-black/10'} ${
      notification.isRead ? 'opacity-75' : ''
    }`}>
      <div className="flex items-start space-x-4">
        {/* Notification Image/Icon */}
        <div className={`w-16 h-16 ${isDarkMode ? 'bg-gray-800/40' : 'bg-gray-100'} rounded-2xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'border border-white/10' : 'border border-black/10'}`}>
          {getIcon(notification.type)}
        </div>

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-semibold text-base line-clamp-1`}>{notification.title}</h3>
            <span className={`${isDarkMode ? 'text-white/60' : 'text-gray-600'} text-sm ml-2 flex-shrink-0`}>
              {new Date(notification.timestamp).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })}
            </span>
          </div>

          <p className={`${isDarkMode ? 'text-white/70' : 'text-gray-600'} text-sm mb-3 line-clamp-3`}>{notification.content}</p>

          {/* Stats and Actions */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-4 text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                <span>{Math.round(notification.relevanceScore * 100)}%</span>
              </div>
              <span className="capitalize">{notification.type}</span>
            </div>
            
            {!notification.isRead && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className={`text-xs ${isDarkMode ? 'text-white/80' : 'text-gray-700'} font-medium`}
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};