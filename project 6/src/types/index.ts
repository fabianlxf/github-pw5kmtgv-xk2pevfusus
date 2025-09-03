export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: Priority;
  targetDate?: string;
  progress: number;
  createdAt: string;
  tags: string[];
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: NotificationType;
  goalId: string;
  source: string;
  timestamp: string;
  isRead: boolean;
  relevanceScore: number;
}

export interface DeletedEvent {
  event: any; // Will be typed as PlanEvent when imported
  deletedAt: string;
}

export interface UserProfile {
  interests: string[];
  preferences: {
    notificationFrequency: 'high' | 'medium' | 'low';
    contentTypes: ContentType[];
    focusAreas: string[];
  };
  goals: Goal[];
}

export type GoalCategory = 
  | 'career' 
  | 'health' 
  | 'education' 
  | 'personal' 
  | 'financial' 
  | 'creative';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationType = 
  | 'insight' 
  | 'reminder' 
  | 'suggestion' 
  | 'milestone';

export type ContentType = 
  | 'books' 
  | 'studies' 
  | 'articles' 
  | 'ideas' 
  | 'exercises';