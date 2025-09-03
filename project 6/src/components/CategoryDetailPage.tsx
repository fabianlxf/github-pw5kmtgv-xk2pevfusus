import React, { useState, useMemo } from 'react';
import { ArrowLeft, Calendar, Clock, Trash2, RotateCcw, Plus, Check, X, Dumbbell, DollarSign, Brain, BookOpen } from 'lucide-react';
import { PlanEvent } from './FlameDashboard';

export type Category = {
  id: string;
  name: string;
  lastActiveISO?: string;
  backgroundImage?: string;
  icon: string;
  color: string;
};

export type DeletedEvent = {
  event: PlanEvent;
  deletedAt: string;
};

interface CategoryDetailPageProps {
  category: Category;
  events: PlanEvent[];
  deletedEvents: DeletedEvent[];
  onBack: () => void;
  onToggleEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onRestoreEvent: (eventId: string) => void;
  onAddEvent: (title: string, description?: string) => void;
  isDarkMode: boolean;
}

export const CategoryDetailPage: React.FC<CategoryDetailPageProps> = ({
  category,
  events,
  deletedEvents,
  onBack,
  onToggleEvent,
  onDeleteEvent,
  onRestoreEvent,
  onAddEvent,
  isDarkMode
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [showActions, setShowActions] = useState<string | null>(null);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = events.reduce((acc, event) => {
      if (!acc[event.date]) {
        acc[event.date] = [];
      }
      acc[event.date].push(event);
      return acc;
    }, {} as Record<string, PlanEvent[]>);

    // Sort dates descending (newest first)
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    
    return sortedDates.map(date => ({
      date,
      events: grouped[date].sort((a, b) => a.time.localeCompare(b.time))
    }));
  }, [events]);

  const stats = useMemo(() => {
    const total = events.length;
    const completed = events.filter(e => e.completed).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, completionRate };
  }, [events]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().slice(0, 10)) {
      return 'Heute';
    } else if (dateStr === yesterday.toISOString().slice(0, 10)) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
    }
  };

  const getIconComponent = (iconName: string, className: string = "w-6 h-6") => {
    switch (iconName) {
      case "Dumbbell":
        return <Dumbbell className={className} />;
      case "DollarSign":
        return <DollarSign className={className} />;
      case "Brain":
        return <Brain className={className} />;
      case "BookOpen":
        return <BookOpen className={className} />;
      default:
        return <Brain className={className} />;
    }
  };

  const handleAddEventSubmit = () => {
    if (newEventTitle.trim()) {
      onAddEvent(newEventTitle.trim());
      setNewEventTitle('');
      setShowAddForm(false);
    }
  };

  return (
    <div 
      className={`min-h-screen transition-all duration-300 relative overflow-hidden`}
      style={{
        backgroundImage: category.backgroundImage ? `url("${encodeURI(category.backgroundImage)}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: (category.id === 'wisdom' || category.id === 'mindset') ? '50% 80%' : 'center',
      }}
    >
      {/* Background Overlay */}
      <div className={`absolute inset-0 ${
        isDarkMode 
          ? 'bg-gradient-to-t from-black/90 via-black/60 to-black/40' 
          : 'bg-gradient-to-t from-white/90 via-white/60 to-white/40'
      }`} />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pt-12">
          <button
            onClick={onBack}
            className={`p-3 rounded-2xl transition-all duration-300 backdrop-blur-md ${
              isDarkMode 
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                : 'bg-black/10 hover:bg-black/20 text-black border border-black/20'
            }`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="text-center">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center backdrop-blur-md border-2 shadow-xl mb-3 ${
              isDarkMode ? 'bg-white/20 border-white/30' : 'bg-black/20 border-black/30'
            }`}>
              {getIconComponent(category.icon, "w-8 h-8 text-white drop-shadow-lg")}
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
              {category.name}
            </h1>
            <div className="text-white/80 text-sm drop-shadow">
              {stats.completed}/{stats.total} Events • {stats.completionRate}% abgeschlossen
            </div>
          </div>
          
          <div className="w-12" /> {/* Spacer for centering */}
        </div>

        {/* Stats Cards */}
        <div className="px-6 mb-6">
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-2xl p-4 backdrop-blur-md border ${
              isDarkMode ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'
            }`}>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.total}</div>
              <div className="text-white/70 text-xs drop-shadow">Gesamt</div>
            </div>
            <div className={`rounded-2xl p-4 backdrop-blur-md border ${
              isDarkMode ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'
            }`}>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.completed}</div>
              <div className="text-white/70 text-xs drop-shadow">Erledigt</div>
            </div>
            <div className={`rounded-2xl p-4 backdrop-blur-md border ${
              isDarkMode ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'
            }`}>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.completionRate}%</div>
              <div className="text-white/70 text-xs drop-shadow">Rate</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddForm(true)}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all duration-300 backdrop-blur-md ${
                isDarkMode 
                  ? 'border-white/30 hover:border-white/50 text-white/70 hover:text-white/90 hover:bg-white/10' 
                  : 'border-black/30 hover:border-black/50 text-black/70 hover:text-black/90 hover:bg-black/10'
              }`}
            >
              <Plus className="w-5 h-5" />
              Event hinzufügen
            </button>
            
            {deletedEvents.length > 0 && (
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className={`px-4 py-2 rounded-2xl transition-all duration-300 backdrop-blur-md ${
                  showDeleted
                    ? 'bg-red-500/30 text-red-300 border border-red-400/50'
                    : (isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20' : 'bg-black/10 text-black/70 hover:bg-black/20 border border-black/20')
                }`}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Add Event Form */}
        {showAddForm && (
          <div className="px-6 mb-6">
            <div className={`rounded-2xl p-4 backdrop-blur-md border ${
              isDarkMode ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'
            }`}>
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="Neues Event hinzufügen..."
                className={`w-full p-3 rounded-xl border mb-3 backdrop-blur-md ${
                  isDarkMode 
                    ? 'bg-white/10 border-white/20 text-white placeholder-white/60' 
                    : 'bg-black/10 border-black/20 text-black placeholder-black/60'
                } focus:outline-none focus:ring-2 focus:ring-orange-500`}
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleAddEventSubmit}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className={`px-4 py-2 rounded-xl transition-colors backdrop-blur-md ${
                    isDarkMode ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' : 'bg-red-500/20 hover:bg-red-500/30 text-red-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Events Section */}
        {showDeleted && deletedEvents.length > 0 && (
          <div className="px-6 mb-6">
            <div className={`rounded-2xl p-4 backdrop-blur-md border ${
              isDarkMode ? 'bg-red-900/20 border-red-500/30' : 'bg-red-500/20 border-red-400/30'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-red-400">
                  Gelöschte Events ({deletedEvents.length})
                </h3>
              </div>
              
              <div className="space-y-3">
                {deletedEvents.map(({ event, deletedAt }) => (
                  <div
                    key={event.id}
                    className={`rounded-xl p-3 border transition-all duration-300 backdrop-blur-md ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                        : 'bg-black/5 border-black/10 hover:bg-black/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm mb-1 text-white/80">
                          {event.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <Clock className="w-3 h-3" />
                          <span>{event.time}</span>
                          <span>•</span>
                          <span>Gelöscht: {new Date(deletedAt).toLocaleDateString('de-DE')}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onRestoreEvent(event.id)}
                        className="p-2 rounded-lg transition-all duration-300 bg-green-500/20 hover:bg-green-500/30 text-green-400"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Events by Date */}
        <div className="px-6 space-y-6">
          {eventsByDate.length === 0 ? (
            <div className="text-center py-12">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center backdrop-blur-md border-2 shadow-xl mb-4 mx-auto ${
                isDarkMode ? 'bg-white/20 border-white/30' : 'bg-black/20 border-black/30'
              }`}>
                <Calendar className="w-8 h-8 text-white/60 drop-shadow-lg" />
              </div>
              <p className="text-lg font-medium mb-2 text-white drop-shadow-lg">Noch keine Events</p>
              <p className="text-sm text-white/70 drop-shadow">Füge dein erstes Event hinzu!</p>
            </div>
          ) : (
            eventsByDate.map(({ date, events: dateEvents }) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white drop-shadow-lg">
                    {formatDate(date)}
                  </h3>
                  <div className="h-px flex-1 bg-white/20" />
                  <span className="text-sm text-white/70 drop-shadow">
                    {dateEvents.length} Event{dateEvents.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {dateEvents.map(event => (
                    <div
                      key={event.id}
                      className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 backdrop-blur-md border ${
                        event.completed 
                          ? 'bg-green-500/20 border-green-400/40'
                          : (isDarkMode ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-black/10 border-black/20 hover:bg-black/20')
                      } hover:scale-[1.02]`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Completion Toggle */}
                        <button
                          onClick={() => onToggleEvent(event.id)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 mt-1 ${
                            event.completed
                              ? 'bg-green-500 border-green-400 text-white'
                              : 'border-white/40 hover:border-white/70 text-white/70'
                          }`}
                        >
                          {event.completed && <Check className="w-4 h-4" />}
                        </button>
  \                      
                        {/* Event Content */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-base mb-1 drop-shadow ${
                            event.completed 
                              ? 'text-green-300 line-through'
                              : 'text-white'
                          }`}>
                            {event.title}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm mb-2 text-white/70 drop-shadow">
                            <Clock className="w-4 h-4" />
                            <span>{event.time}</span>
                          </div>
                          
                          {event.description && (
                            <p className="text-sm text-white/60 drop-shadow line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Actions Menu */}
                        <div className="relative">
                          <button
                            onClick={() => setShowActions(showActions === event.id ? null : event.id)}
                            className="p-2 rounded-xl transition-all duration-300 hover:bg-white/10 text-white/60"
                          >
                            <div className="w-1 h-1 bg-current rounded-full mb-1"></div>
                            <div className="w-1 h-1 bg-current rounded-full mb-1"></div>
                            <div className="w-1 h-1 bg-current rounded-full"></div>
                \          </button>
                          
                          {showActions === event.id && (
                            <>
                              {/* Backdrop */}
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowActions(null)}
                              />
                              
                              {/* Menu */}
                              <div className={`absolute right-0 top-full mt-2 z-20 rounded-xl border shado\w-lg overflow-hidden backdrop-blur-md ${
                                isDarkMode ? 'bg-gray-800/90 border-gray-600/50' : 'bg-white/90 border-gray-300/50'
                              }`}>
                  \              <button
                                  onClick={() => {
                                    onDeleteEvent(event.id);
                                    setShowActions(null);
                                  }}
                                  className="w-full px-4 py-3 text-left flex items-center gap-2 transition-colors hover:bg-red-500/20 text-red-400"
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
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};