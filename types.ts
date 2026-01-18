
export enum TimerState {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
}

export type EMOMVariant = 'EMOM' | 'E2MOM' | 'E3MOM' | 'E5MOM';

export interface WorkoutHistory {
  id: string;
  title: string;
  date: string;
  startTime: string;
  targetMinutes: number;
  actualMinutes: number;
  status: 'completed' | 'interrupted';
}
