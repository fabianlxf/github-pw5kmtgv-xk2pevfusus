import React, { useMemo } from 'react';
import { Dumbbell, DollarSign, Brain, BookOpen, Flame, TrendingUp } from 'lucide-react';
import RadialOrbitalTimeline from './ui/radial-orbital-timeline';
import { Category, PlanEvent } from './FlameDashboard';

interface WeeklyReportPageProps {
  categories: Category[];
  dayPlan: PlanEvent[];
  isDarkMode: boolean;
}

interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

export default function WeeklyReportPage({ categories, dayPlan, isDarkMode }: WeeklyReportPageProps) {
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "Dumbbell":
        return Dumbbell;
      case "DollarSign":
        return DollarSign;
      case "Brain":
        return Brain;
      case "BookOpen":
        return BookOpen;
      default:
        return Brain;
    }
  };

  const getCategoryStats = (categoryId: string) => {
    const categoryEvents = dayPlan.filter(e => e.category === categoryId);
    const completedEvents = categoryEvents.filter(e => e.completed);
    const totalEvents = categoryEvents.length;
    const completionRate = totalEvents > 0 ? Math.round((completedEvents.length / totalEvents) * 100) : 0;
    
    return {
      total: totalEvents,
      completed: completedEvents.length,
      completionRate,
      energy: Math.min(100, completionRate + (completedEvents.length * 10))
    };
  };

  const timelineData: TimelineItem[] = useMemo(() => {
    return categories.map((category, index) => {
      const stats = getCategoryStats(category.id);
      const nextCategoryIndex = (index + 1) % categories.length;
      const prevCategoryIndex = (index - 1 + categories.length) % categories.length;
      
      let status: "completed" | "in-progress" | "pending" = "pending";
      if (stats.completionRate >= 80) status = "completed";
      else if (stats.completionRate >= 30) status = "in-progress";

      let content = `${stats.completed} von ${stats.total} Events abgeschlossen`;
      if (stats.total === 0) {
        content = "Noch keine Events in dieser Kategorie";
      }

      return {
        id: index + 1,
        title: category.name,
        date: new Date().toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }),
        content,
        category: category.id,
        icon: getIconComponent(category.icon),
        relatedIds: [nextCategoryIndex + 1, prevCategoryIndex + 1].filter(id => id !== index + 1),
        status,
        energy: stats.energy
      };
    });
  }, [categories, dayPlan]);

  const overallStats = useMemo(() => {
    const totalEvents = dayPlan.length;
    const completedEvents = dayPlan.filter(e => e.completed).length;
    const overallProgress = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;
    
    const categoryProgress = categories.map(cat => {
      const stats = getCategoryStats(cat.id);
      return {
        name: cat.name,
        progress: stats.completionRate,
        icon: getIconComponent(cat.icon)
      };
    });

    return {
      totalEvents,
      completedEvents,
      overallProgress,
      categoryProgress
    };
  }, [categories, dayPlan]);

  return (
    <div className="relative min-h-screen">
      {/* Radial Timeline */}
      <div className="relative z-10">
        <RadialOrbitalTimeline timelineData={timelineData} />
      </div>

      {/* Overlay Stats */}
      <div className="absolute top-4 left-2 md:top-6 md:left-6 z-20">
        <div className="bg-black/80 backdrop-blur-md rounded-lg md:rounded-xl p-2 md:p-3 border border-white/20 max-w-[140px] md:max-w-xs">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
            <h2 className="text-sm md:text-lg font-bold text-white">Report</h2>
          </div>
          
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">Fortschritt</span>
              <span className="text-white font-bold text-xs md:text-sm">{overallStats.overallProgress}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">Events</span>
              <span className="text-white font-bold text-xs md:text-sm">{overallStats.completedEvents}/{overallStats.totalEvents}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Progress */}
      <div className="absolute top-4 right-2 md:top-6 md:right-6 z-20">
        <div className="bg-black/80 backdrop-blur-md rounded-lg md:rounded-xl p-2 md:p-3 border border-white/20 max-w-[140px] md:max-w-xs">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
            <h3 className="text-xs md:text-base font-semibold text-white">Kategorien</h3>
          </div>
          
          <div className="space-y-1 md:space-y-2">
            {overallStats.categoryProgress.map((cat, index) => {
              const Icon = cat.icon;
              return (
                <div key={index} className="flex items-center gap-1 md:gap-2">
                  <Icon className="w-3 h-3 text-white/60 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 text-xs truncate">{cat.name}</span>
                      <span className="text-white text-xs font-mono ml-1">{cat.progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          cat.progress >= 80 ? 'bg-green-400' :
                          cat.progress >= 50 ? 'bg-yellow-400' :
                          cat.progress >= 20 ? 'bg-orange-400' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${cat.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-20 px-2">
        <div className="bg-black/60 backdrop-blur-md rounded-lg px-2 md:px-3 py-1 md:py-2 border border-white/20">
          <p className="text-white/70 text-xs md:text-sm text-center">
            Tippe auf Kategorien für Details
          </p>
        </div>
      </div>
    </div>
  );
}