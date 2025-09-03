import React, { useEffect, useMemo, useState } from "react";
import FlameDashboard, { Category, PlanEvent } from "./components/FlameDashboard";
import { CategoryDetailPage } from "./components/CategoryDetailPage";
import PosterSplash from "./components/PosterSplash";
import WeeklyReportPage from "./components/WeeklyReportPage";
import CalendarPage from "./components/CalendarPage";
import { LiveTaskNotification } from "./components/LiveTaskNotification";
import { Dumbbell, DollarSign, Brain, BookOpen, Home, BarChart3, Calendar, Clock, Check, Trash2 } from "lucide-react";

export type DeletedEvent = {
  event: PlanEvent;
  deletedAt: string;
};

// ➕ NEU: SpeechInput & API-Call

type Page = "home" | "reports" | "category" | "plan";

const DEFAULT_CATS: Category[] = [
  { 
    id: "fitness", 
    name: "Fitness",
    icon: "Dumbbell",
    color: "from-red-500 to-orange-500",
    backgroundImage: "/posters/fitness.png"
  },
  { 
    id: "finanzen", 
    name: "Finance",
    icon: "DollarSign",
    color: "from-green-500 to-emerald-500",
    backgroundImage: "/posters/finanzen.jpeg"
  },
  { 
    id: "mindset", 
    name: "Mindset",
    icon: "Brain",
    color: "from-purple-500 to-pink-500",
    backgroundImage: "/posters/mindset.png"
  },
  { 
    id: "wisdom", 
    name: "Wisdom",
    icon: "BookOpen",
    color: "from-blue-500 to-cyan-500",
    backgroundImage: "/posters/wisdom.jpeg"
  },
];

function getFlameState(lastActiveISO: string | undefined, graceHours: number, now: Date): "active" | "grace" | "cold" {
  if (!lastActiveISO) return "cold";
  
  const lastActive = new Date(lastActiveISO);
  const diffHours = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
  
  if (diffHours <= 24) return "active";
  if (diffHours <= 24 + graceHours) return "grace";
  return "cold";
}

const LOCAL_KEY_CATS = "app.categories.v1";
const LOCAL_KEY_POSTER_SHOWN = "app.posterShown.today.v1";
const LOCAL_KEY_DAY_PLAN = "app.dayPlan.v1";
const LOCAL_KEY_THEME = "app.theme.v1";
const LOCAL_KEY_DELETED_EVENTS = "app.deletedEvents.v1";

function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_CATS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CATS;
}

function saveCategories(cats: Category[]) {
  try {
    localStorage.setItem(LOCAL_KEY_CATS, JSON.stringify(cats));
  } catch {}
}

function loadDayPlan(): PlanEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_DAY_PLAN);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveDayPlan(plan: PlanEvent[]) {
  try {
    localStorage.setItem(LOCAL_KEY_DAY_PLAN, JSON.stringify(plan));
  } catch {}
}

function loadDeletedEvents(): DeletedEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_DELETED_EVENTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveDeletedEvents(events: DeletedEvent[]) {
  try {
    localStorage.setItem(LOCAL_KEY_DELETED_EVENTS, JSON.stringify(events));
  } catch {}
}

function loadTheme(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_THEME);
    if (raw) return JSON.parse(raw);
  } catch {}
  return true; // Default to dark mode
}

function saveTheme(isDark: boolean) {
  try {
    localStorage.setItem(LOCAL_KEY_THEME, JSON.stringify(isDark));
  } catch {}
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function generateEventId() {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get live task
function getLiveTask(dayPlan: PlanEvent[]): PlanEvent | null {
  const now = new Date();
  return dayPlan.find((event) => {
    if (event.completed) return false;
    
    const eventTime = new Date(`${now.toDateString()} ${event.time}`);
    const diffMinutes = Math.abs(now.getTime() - eventTime.getTime()) / (1000 * 60);
    return diffMinutes <= 30; // Within 30 minutes
  }) || null;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [posterVisible, setPosterVisible] = useState(true);
  const [dayPlan, setDayPlan] = useState<PlanEvent[]>(loadDayPlan());
  const [deletedEvents, setDeletedEvents] = useState<DeletedEvent[]>(loadDeletedEvents());
  const [categories, setCategories] = useState<Category[]>(loadCategories());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(loadTheme());
  const [graceHours] = useState<number>(10);

  // Get current live task
  const liveTask = useMemo(() => getLiveTask(dayPlan), [dayPlan]);

  // Set up reminder notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    
    const checkReminders = () => {
      const now = new Date();
      
      dayPlan.forEach(event => {
        if (event.completed || !event.reminderMinutes || event.reminderMinutes === 0) return;
        
        const eventTime = new Date(`${now.toDateString()} ${event.time}`);
        const reminderTime = new Date(eventTime.getTime() - (event.reminderMinutes * 60 * 1000));
        const diffMs = Math.abs(now.getTime() - reminderTime.getTime());
        
        // Show reminder if we're within 1 minute of reminder time
        if (diffMs <= 60000 && now >= reminderTime && now < eventTime) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`🔔 Erinnerung: ${event.title}`, {
              body: `Startet in ${event.reminderMinutes} Minuten um ${event.time}`,
              icon: '/icon-192.png',
              tag: `reminder-${event.id}`,
              requireInteraction: false
            });
          }
        }
      });
    };
    
    // Check reminders every minute
    const interval = setInterval(checkReminders, 60000);
    checkReminders(); // Check immediately
    
    return () => clearInterval(interval);
  }, [dayPlan]);

  // Poster heute nur einmal zeigen
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(LOCAL_KEY_POSTER_SHOWN);
    if (last === todayKey) {
      setPosterVisible(false);
    } else {
      setPosterVisible(true);
      localStorage.setItem(LOCAL_KEY_POSTER_SHOWN, todayKey);
    }
  }, []);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    saveDayPlan(dayPlan);
  }, [dayPlan]);

  useEffect(() => {
    saveDeletedEvents(deletedEvents);
  }, [deletedEvents]);

  useEffect(() => {
    saveTheme(isDarkMode);
  }, [isDarkMode]);

  // Master-Percent Anzeige
  const masterPercent = useMemo(() => {
    const now = new Date();
    const activeCount = categories.filter((c) => {
      const state = getFlameState(c.lastActiveISO, graceHours, now);
      return state === "active" || state === "grace";
    }).length;
    return Math.round((activeCount / Math.max(1, categories.length)) * 100);
  }, [categories, graceHours]);

  // Kategorien anhand des KI-Plans „anfeuern"
  function markCategoriesActiveFromPlan(events: any[]) {
    const nowISO = new Date().toISOString();
    const found = new Set<string>();
    for (const ev of events) {
      const cat = (ev.category || "").trim().toLowerCase();
      if (cat) found.add(cat);
    }
    if (found.size === 0) return;

    setCategories((prev) => {
      const next = [...prev];
      const idxById = new Map<string, number>();
      next.forEach((c, i) => idxById.set(c.id, i));

      for (const raw of found) {
        const id = slugify(raw);
        if (idxById.has(id)) {
          const i = idxById.get(id)!;
          next[i] = { ...next[i], lastActiveISO: nowISO };
        }
      }
      return next;
    });
  }

  const handlePlanGenerated = (newEvents: PlanEvent[]) => {
    setDayPlan(prev => [...prev, ...newEvents]);
    
    // Markiere Kategorien als aktiv basierend auf den neuen Events
    const nowISO = new Date().toISOString();
    const foundCategories = new Set(newEvents.map(e => e.category));
    
    setCategories(prev => prev.map(cat => 
      foundCategories.has(cat.id) 
        ? { ...cat, lastActiveISO: nowISO }
        : cat
    ));
  };
  const handleToggleEvent = (eventId: string) => {
    setDayPlan(prev => prev.map(event => 
      event.id === eventId 
        ? { ...event, completed: !event.completed }
        : event
    ));
  };

  const handleDeleteEvent = (eventId: string) => {
    const eventToDelete = dayPlan.find(e => e.id === eventId);
    if (eventToDelete) {
      // Add to deleted events
      const deletedEvent: DeletedEvent = {
        event: eventToDelete,
        deletedAt: new Date().toISOString()
      };
      setDeletedEvents(prev => [...prev, deletedEvent]);
      
      // Remove from active events
      setDayPlan(prev => prev.filter(e => e.id !== eventId));
    }
  };

  const handleRestoreEvent = (eventId: string) => {
    const deletedEvent = deletedEvents.find(de => de.event.id === eventId);
    if (deletedEvent) {
      // Add back to active events
      setDayPlan(prev => [...prev, deletedEvent.event]);
      
      // Remove from deleted events
      setDeletedEvents(prev => prev.filter(de => de.event.id !== eventId));
    }
  };

  const handleAddCustomEvent = (title: string, category: string) => {
    const newEvent: PlanEvent = {
      id: generateEventId(),
      title,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      category,
      completed: false,
      date: new Date().toISOString().slice(0, 10)
    };
    setDayPlan(prev => [...prev, newEvent]);
  };

  const handleAddEventWithDetails = (title: string, category: string, date: string, time: string, reminderMinutes?: number) => {
    const newEvent: PlanEvent = {
      id: generateEventId(),
      title,
      time,
      category,
      completed: false,
      date,
      reminderMinutes: reminderMinutes || 0
    };
    setDayPlan(prev => [...prev, newEvent]);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setCurrentPage("category");
  };

  const handleBackFromCategory = () => {
    setSelectedCategoryId(null);
    setCurrentPage("home");
  };

  const handleToggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Live Task Notification */}
      <LiveTaskNotification 
        liveTask={liveTask}
        onComplete={handleToggleEvent}
        isDarkMode={isDarkMode}
      />
      
      {/* Poster Overlay */}
      {posterVisible && (
        <PosterSplash 
          masterPercent={masterPercent}
          onDismiss={() => setPosterVisible(false)}
        />
      )}

      {/* Main Pages */}
      <div className="relative z-10 min-h-screen pb-20">
        {currentPage === "home" && (
          <FlameDashboard 
            categories={categories} 
            graceHours={graceHours}
            dayPlan={dayPlan}
            onToggleEvent={handleToggleEvent}
            onAddCustomEvent={handleAddCustomEvent}
            onCategoryClick={handleCategoryClick}
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            onPlanGenerated={handlePlanGenerated}
          />
        )}

        {currentPage === "plan" && (
          <CalendarPage
            dayPlan={dayPlan}
            onToggleEvent={handleToggleEvent}
            onDeleteEvent={handleDeleteEvent}
            onAddEvent={handleAddEventWithDetails}
            categories={categories}
            isDarkMode={isDarkMode}
          />
        )}
        {currentPage === "category" && selectedCategoryId && (
          <CategoryDetailPage
            category={categories.find(c => c.id === selectedCategoryId)!}
            events={dayPlan.filter(e => e.category === selectedCategoryId)}
            deletedEvents={deletedEvents.filter(de => de.event.category === selectedCategoryId)}
            onBack={handleBackFromCategory}
            onToggleEvent={handleToggleEvent}
            onDeleteEvent={handleDeleteEvent}
            onRestoreEvent={handleRestoreEvent}
            onAddEvent={(title, description) => {
              const newEvent: PlanEvent = {
                id: generateEventId(),
                title,
                time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                category: selectedCategoryId,
                completed: false,
                description
              };
              setDayPlan(prev => [...prev, newEvent]);
            }}
            isDarkMode={isDarkMode}
          />
        )}

        {currentPage === "reports" && (
          <WeeklyReportPage 
            categories={categories}
            dayPlan={dayPlan}
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className={`fixed bottom-0 inset-x-0 ${
        isDarkMode ? 'bg-black/80 border-gray-700' : 'bg-white/80 border-gray-300'
      } border-t backdrop-blur-md flex justify-around items-center h-16 z-20`}>
        <button
          onClick={() => setCurrentPage("home")}
          className={`flex-1 h-full flex items-center justify-center text-2xl transition-all duration-300 ${
            currentPage === "home" 
              ? (isDarkMode ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-900")
              : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900")
          }`}
        >
          <Home className="w-6 h-6" />
        </button>
        <button
          onClick={() => setCurrentPage("plan")}
          className={`flex-1 h-full flex items-center justify-center text-2xl transition-all duration-300 ${
            currentPage === "plan" 
              ? (isDarkMode ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-900")
              : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900")
          }`}
        >
          <Calendar className="w-6 h-6" />
        </button>
        <button
          onClick={() => setCurrentPage("reports")}
          className={`flex-1 h-full flex items-center justify-center text-2xl transition-all duration-300 ${
            currentPage === "reports" 
              ? (isDarkMode ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-900")
              : (isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900")
          }`}
        >
          <BarChart3 className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
}