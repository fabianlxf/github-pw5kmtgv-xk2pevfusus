import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Check, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PlanEvent } from './FlameDashboard';

interface CalendarPageProps {
  dayPlan: PlanEvent[];
  onToggleEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onAddEvent: (title: string, category: string, date: string, time: string, reminderMinutes?: number) => void;
  categories: Array<{ id: string; name: string; icon: string }>;
  isDarkMode: boolean;
}

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarPage({
  dayPlan,
  onToggleEvent,
  onDeleteEvent,
  onAddEvent,
  categories,
  isDarkMode
}: CalendarPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('fitness');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventReminder, setNewEventReminder] = useState<number>(30);

  const getDurationMinutes = (event: PlanEvent): number => {
    if (event.description) {
      const match = event.description.match(/(\d+)\s*(min|minute|stunde|hour)/i);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit.includes('stunde') || unit.includes('hour')) {
          return value * 60;
        }
        return value;
      }
    }
    return 30; // Default 30 minutes
  };

  const getEventsForDate = (date: string) => {
    return dayPlan.filter(event => event.date === date || !event.date);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('de-DE', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    
    // Start from Monday of the week containing the first day
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - daysToSubtract);
    
    const days = [];
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const handleAddEvent = () => {
    if (newEventTitle.trim()) {
      onAddEvent(newEventTitle.trim(), newEventCategory, selectedDate, newEventTime, newEventReminder);
      setNewEventTitle('');
      setShowAddForm(false);
    }
  };

  const renderDayView = () => {
    const dateStr = currentDate.toISOString().slice(0, 10);
    const events = getEventsForDate(dateStr).sort((a, b) => a.time.localeCompare(b.time));
    
    return (
      <div className="space-y-3">
        {events.map((event) => {
          const now = new Date();
          const eventTime = new Date(`${now.toDateString()} ${event.time}`);
          const isLive = Math.abs(now.getTime() - eventTime.getTime()) < 30 * 60 * 1000;
          const durationMinutes = getDurationMinutes(event);
          const baseHeight = Math.max(60, Math.min(200, (durationMinutes / 30) * 60));
          const category = categories.find(c => c.id === event.category);
          
          return (
            <div
              key={event.id}
              className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 backdrop-blur-md border-2 ${
                isLive 
                  ? 'bg-green-500/20 border-green-400/50 animate-pulse'
                  : event.completed 
                    ? (isDarkMode ? 'bg-green-900/30 border-green-500/30' : 'bg-green-100 border-green-300')
                    : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:shadow-lg')
              } transform hover:scale-[1.02]`}
              style={{ minHeight: `${baseHeight}px` }}
            >
              <div className="flex items-start gap-4 h-full">
                <button
                  onClick={() => onToggleEvent(event.id)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                    event.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : (isDarkMode ? 'border-white/30 hover:border-white/60' : 'border-gray-300 hover:border-gray-500')
                  }`}
                >
                  {event.completed && <Check className="w-4 h-4" />}
                </button>
                
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`font-bold text-lg mb-2 ${
                    isLive 
                      ? 'text-green-300'
                      : event.completed 
                        ? (isDarkMode ? 'text-green-300 line-through' : 'text-green-700 line-through')
                        : (isDarkMode ? 'text-white' : 'text-gray-900')
                  }`}>
                    {event.title}
                    {isLive && <span className="ml-2 text-sm font-normal text-green-400">● LIVE</span>}
                  </div>
                  
                  <div className={`flex items-center gap-3 text-sm mb-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">{event.time}</span>
                      <span className="text-xs opacity-70">({durationMinutes} Min)</span>
                        {event.reminderMinutes && event.reminderMinutes > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                              🔔 {event.reminderMinutes}min
                            </span>
                          </div>
                        )}
                        
                    </div>
                    
                    {category && (
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          category.id === 'fitness' ? 'bg-red-400' :
                          category.id === 'mindset' ? 'bg-purple-400' :
                          category.id === 'wisdom' ? 'bg-blue-400' :
                          category.id === 'finanzen' ? 'bg-green-400' :
                          'bg-gray-400'
                        }`}></div>
                        <span>{category.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {event.description && (
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    } line-clamp-2`}>
                      {event.description}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={() => onDeleteEvent(event.id)}
                  className={`p-2 rounded-xl transition-all duration-300 ${
                    isDarkMode 
                      ? 'hover:bg-red-500/20 text-red-400/60 hover:text-red-400' 
                      : 'hover:bg-red-100 text-red-500/60 hover:text-red-600'
                  }`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
        
        {events.length === 0 && (
          <div className="text-center py-12">
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${
              isDarkMode ? 'text-white/40' : 'text-gray-400'
            }`} />
            <p className={`text-lg font-medium mb-2 ${
              isDarkMode ? 'text-white/70' : 'text-gray-600'
            }`}>
              Keine Events für heute
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, index) => (
            <div key={day} className={`text-center text-sm font-medium p-2 ${
              isDarkMode ? 'text-white/70' : 'text-gray-600'
            }`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const dateStr = day.toISOString().slice(0, 10);
            const events = getEventsForDate(dateStr);
            const isToday = dateStr === new Date().toISOString().slice(0, 10);
            
            return (
              <div
                key={index}
                className={`min-h-24 p-2 rounded-lg border transition-all duration-300 ${
                  isToday
                    ? (isDarkMode ? 'bg-blue-500/20 border-blue-400/50' : 'bg-blue-100 border-blue-300')
                    : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:shadow-md')
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday 
                    ? (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                    : (isDarkMode ? 'text-white' : 'text-gray-900')
                }`}>
                  {day.getDate()}
                </div>
                
                <div className="space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded truncate ${
                        event.completed
                          ? (isDarkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700')
                          : (isDarkMode ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700')
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                      +{events.length - 3} mehr
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthDays = getMonthDays(currentDate);
    const currentMonth = currentDate.getMonth();
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
            <div key={day} className={`text-center text-sm font-medium p-2 ${
              isDarkMode ? 'text-white/70' : 'text-gray-600'
            }`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day, index) => {
            const dateStr = day.toISOString().slice(0, 10);
            const events = getEventsForDate(dateStr);
            const isToday = dateStr === new Date().toISOString().slice(0, 10);
            const isCurrentMonth = day.getMonth() === currentMonth;
            
            return (
              <div
                key={index}
                className={`aspect-square p-1 rounded-lg border transition-all duration-300 ${
                  isToday
                    ? (isDarkMode ? 'bg-blue-500/20 border-blue-400/50' : 'bg-blue-100 border-blue-300')
                    : isCurrentMonth
                      ? (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:shadow-md')
                      : (isDarkMode ? 'bg-gray-800/20 border-gray-700/30' : 'bg-gray-50 border-gray-100')
                } ${!isCurrentMonth ? 'opacity-50' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  isToday 
                    ? (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                    : isCurrentMonth
                      ? (isDarkMode ? 'text-white' : 'text-gray-900')
                      : (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                }`}>
                  {day.getDate()}
                </div>
                
                {events.length > 0 && (
                  <div className={`w-2 h-2 rounded-full ${
                    events.some(e => e.completed) 
                      ? 'bg-green-400' 
                      : (isDarkMode ? 'bg-white/60' : 'bg-gray-400')
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleAddEventSubmit = () => {
    if (newEventTitle.trim()) {
      onAddEvent(newEventTitle.trim(), newEventCategory, selectedDate, newEventTime);
      setNewEventTitle('');
      setShowAddForm(false);
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      <div className="p-4 md:p-6 pt-12 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl md:text-3xl font-bold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Plan
          </h1>
          
          <button
            onClick={() => setShowAddForm(true)}
            className={`p-3 rounded-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                : 'bg-black/10 hover:bg-black/20 text-black border border-black/20'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Selector */}
        <div className={`flex rounded-xl p-1 mb-6 ${
          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
        }`}>
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                viewMode === mode
                  ? (isDarkMode ? 'bg-white text-black' : 'bg-white text-gray-900 shadow-sm')
                  : (isDarkMode ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900')
              }`}
            >
              {mode === 'day' ? 'Tag' : mode === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateDate('prev')}
            className={`p-2 rounded-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className={`text-lg font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {viewMode === 'day' 
              ? formatDate(currentDate)
              : viewMode === 'week'
                ? `${formatDateShort(getWeekDays(currentDate)[0])} - ${formatDateShort(getWeekDays(currentDate)[6])}`
                : currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
            }
          </div>
          
          <button
            onClick={() => navigateDate('next')}
            className={`p-2 rounded-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Add Event Form */}
        {showAddForm && (
          <div className={`rounded-2xl p-4 mb-6 backdrop-blur-md border ${
            isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white border-gray-200'
          }`}>
            <div className="space-y-4">
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="Event-Titel..."
                className={`w-full p-3 rounded-xl border ${
                  isDarkMode 
                    ? 'bg-white/10 border-white/20 text-white placeholder-white/60' 
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={newEventCategory}
                  onChange={(e) => setNewEventCategory(e.target.value)}
                  className={`p-3 rounded-xl border ${
                    isDarkMode 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className={isDarkMode ? "bg-gray-800" : "bg-white"}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                
                <input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className={`p-3 rounded-xl border ${
                    isDarkMode 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              
              <div className="mb-3">
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-white/80' : 'text-gray-700'
                }`}>
                  Erinnerung
                </label>
                <select
                  value={newEventReminder}
                  onChange={(e) => setNewEventReminder(Number(e.target.value))}
                  className={`w-full p-3 rounded-xl border ${
                    isDarkMode 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value={0} className={isDarkMode ? "bg-gray-800" : "bg-white"}>Keine Erinnerung</option>
                  <option value={15} className={isDarkMode ? "bg-gray-800" : "bg-white"}>15 Min vorher</option>
                  <option value={30} className={isDarkMode ? "bg-gray-800" : "bg-white"}>30 Min vorher</option>
                  <option value={60} className={isDarkMode ? "bg-gray-800" : "bg-white"}>1 Std vorher</option>
                  <option value={120} className={isDarkMode ? "bg-gray-800" : "bg-white"}>2 Std vorher</option>
                </select>
              </div>
              
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full p-3 rounded-xl border ${
                  isDarkMode 
                    ? 'bg-white/10 border-white/20 text-white' 
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              
              <div className="flex gap-3">
                <button
                  onClick={handleAddEventSubmit}
                  className="flex-1 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium"
                >
                  Hinzufügen
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className={`px-6 py-3 rounded-xl transition-colors ${
                    isDarkMode 
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                      : 'bg-red-100 hover:bg-red-200 text-red-600'
                  }`}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Content */}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>
    </div>
  );
}