
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimerState, WorkoutHistory, EMOMVariant } from './types';
import { audioService } from './services/AudioService';
import CircularProgress from './components/CircularProgress';

const FACTS = [
  "HIIT triggers Excess Post-exercise Oxygen Consumption, boosting metabolic rate and calorie burn for hours after the workout ends.",
  "Research shows HIIT reduces blood pressure and improves arterial elasticity more effectively than traditional continuous cardio.",
  "A 2024 study found that EMOM protocols cause less neuromuscular fatigue and lower lactate buildup compared to AMRAP training.",
  "HIIT provides similar cardiovascular and metabolic benefits in roughly 40% less time than moderate-intensity continuous training.",
  "HIIT is proven to increase VO2 max by forcing the heart to pump more blood and muscles to use oxygen more efficiently.",
  "EMOM training has been shown to lead to faster Heart Rate Variability (HRV) recovery post-workout compared to other high-intensity modalities.",
  "Short, intense intervals are scientifically linked to rapid improvements in insulin sensitivity and blood sugar management in two weeks.",
  "EMOM's built-in rest helps athletes maintain a more consistent movement velocity, preventing form breakdown often seen in timed workouts."
];

const VARIANT_INTERVALS: Record<EMOMVariant, number> = {
  'EMOM': 60,
  'E2MOM': 120,
  'E3MOM': 180,
  'E5MOM': 300,
};

const App: React.FC = () => {
  // Persistence states
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('emom_user_name') || 'Athlete');
  const [defaultReps, setDefaultReps] = useState<number>(() => Number(localStorage.getItem('emom_default_reps')) || 20);
  const [defaultVariant, setDefaultVariant] = useState<EMOMVariant>(() => (localStorage.getItem('emom_default_variant') as EMOMVariant) || 'EMOM');

  // Current session states
  const [targetReps, setTargetReps] = useState<number>(defaultReps);
  const [variant, setVariant] = useState<EMOMVariant>(defaultVariant);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [prepSeconds, setPrepSeconds] = useState<number>(5);
  const [state, setState] = useState<TimerState>(TimerState.IDLE);
  const [history, setHistory] = useState<WorkoutHistory[]>([]);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const wakeLock = useRef<any>(null);
  const timerRef = useRef<number | null>(null);

  const intervalSeconds = VARIANT_INTERVALS[variant];
  const totalDurationMinutes = (targetReps * intervalSeconds) / 60;

  const dailyFact = useMemo(() => {
    return FACTS[Math.floor(Math.random() * FACTS.length)];
  }, []);

  // Update session settings when defaults change
  useEffect(() => {
    if (state === TimerState.IDLE) {
      setTargetReps(defaultReps);
    }
  }, [defaultReps]);

  useEffect(() => {
    if (state === TimerState.IDLE) {
      setVariant(defaultVariant);
      setSecondsLeft(VARIANT_INTERVALS[defaultVariant]);
    }
  }, [defaultVariant]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('emom_user_name', userName);
    localStorage.setItem('emom_default_reps', defaultReps.toString());
    localStorage.setItem('emom_default_variant', defaultVariant);
  }, [userName, defaultReps, defaultVariant]);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLock.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLock.current) {
      wakeLock.current.release().then(() => {
        wakeLock.current = null;
      });
    }
  };

  useEffect(() => {
    if (state !== TimerState.IDLE) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [state]);

  useEffect(() => {
    const saved = localStorage.getItem('emom_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('emom_history', JSON.stringify(history));
  }, [history]);

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const startWorkout = () => {
    audioService.init();
    setIsFinished(false);
    setState(TimerState.PREPARING);
    setPrepSeconds(5);
    audioService.playBeep(440, 0.1);
    triggerHaptic();
  };

  const createWorkoutEntry = () => {
    const now = new Date();
    const id = Math.random().toString(36).substr(2, 9);
    const newEntry: WorkoutHistory = {
      id,
      title: `${variant} - ${history.length + 1}`,
      date: now.toLocaleDateString(),
      startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      targetMinutes: totalDurationMinutes,
      actualMinutes: 0,
      status: 'interrupted'
    };
    setHistory([newEntry, ...history]);
    setActiveWorkoutId(id);
  };

  const updateActiveWorkout = (roundsDone: number, finished: boolean = false) => {
    if (!activeWorkoutId) return;
    const actualMinutes = (roundsDone * intervalSeconds) / 60;
    setHistory(prev => prev.map(item => {
      if (item.id === activeWorkoutId) {
        return {
          ...item,
          actualMinutes,
          status: finished ? 'completed' : 'interrupted'
        };
      }
      return item;
    }));
  };

  const resetWorkout = () => {
    if (state !== TimerState.IDLE) {
      updateActiveWorkout(currentRound - 1);
    }
    setState(TimerState.IDLE);
    setCurrentRound(0);
    setSecondsLeft(intervalSeconds);
    setPrepSeconds(5);
    setActiveWorkoutId(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (state === TimerState.PREPARING) {
      timerRef.current = window.setInterval(() => {
        setPrepSeconds((prev) => {
          if (prev <= 1) {
            createWorkoutEntry();
            setState(TimerState.RUNNING);
            setCurrentRound(1);
            setSecondsLeft(intervalSeconds);
            audioService.playBeep(880, 0.4);
            triggerHaptic();
            return 0;
          }
          audioService.playBeep(440, 0.1);
          triggerHaptic();
          return prev - 1;
        });
      }, 1000) as unknown as number;
    } else if (state === TimerState.RUNNING) {
      timerRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (currentRound >= targetReps) {
              updateActiveWorkout(targetReps, true);
              setState(TimerState.IDLE);
              setIsFinished(true);
              audioService.playFinalBeep();
              triggerHaptic();
              return intervalSeconds;
            }
            updateActiveWorkout(currentRound);
            setCurrentRound(prevRound => prevRound + 1);
            audioService.playBeep(880, 0.3);
            triggerHaptic();
            return intervalSeconds;
          }
          if (prev <= 4 && prev > 1) {
            audioService.playBeep(440, 0.1);
          }
          return prev - 1;
        });
      }, 1000) as unknown as number;
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, targetReps, currentRound, intervalSeconds, variant]);

  const progress = state === TimerState.PREPARING ? (5 - prepSeconds) / 5 : (intervalSeconds - secondsLeft) / intervalSeconds;

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white p-6 safe-top safe-bottom overflow-hidden relative">
      <header className="flex justify-between items-center pt-8 pb-4 z-20">
        <h1 className="text-xl font-bold tracking-tight text-zinc-200">EMOM TIMER</h1>
        
        <div className="flex items-center space-x-2">
          {state === TimerState.IDLE && !showHistory && !showSettings && (
            <div className="relative">
              <select 
                value={variant}
                onChange={(e) => {
                  const val = e.target.value as EMOMVariant;
                  setVariant(val);
                  setSecondsLeft(VARIANT_INTERVALS[val]);
                }}
                className="appearance-none bg-zinc-900 border border-zinc-800 text-white pl-3 pr-8 py-2 rounded-lg font-bold text-xs tracking-widest focus:outline-none focus:ring-1 focus:ring-red-600 transition-all cursor-pointer"
              >
                <option value="EMOM">EMOM</option>
                <option value="E2MOM">E2MOM</option>
                <option value="E3MOM">E3MOM</option>
                <option value="E5MOM">E5MOM</option>
              </select>
              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-zinc-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => { setShowHistory(!showHistory); setShowSettings(false); setIsFinished(false); }}
            className={`p-2 rounded-full transition-colors ${showHistory ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <button 
            onClick={() => { setShowSettings(!showSettings); setShowHistory(false); setIsFinished(false); }}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative">
        {isFinished && !showHistory && !showSettings ? (
          <div className="flex flex-col items-center justify-center space-y-8 animate-in zoom-in-90 duration-500">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-900/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tight uppercase">Great Work {userName}!</h2>
              <p className="text-zinc-500 font-medium">Workout completed: {totalDurationMinutes} minutes</p>
            </div>
            <button 
              onClick={() => setIsFinished(false)}
              className="px-10 py-4 rounded-2xl bg-zinc-900 text-white font-bold border border-zinc-800 active:scale-95 transition-transform"
            >
              FINISH
            </button>
          </div>
        ) : showHistory ? (
          <div className="w-full h-full animate-in slide-in-from-bottom-4 duration-300 flex flex-col pt-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-zinc-400">Activity History</h2>
              <button onClick={() => setHistory([])} className="text-xs text-red-500 opacity-50">Clear All</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {history.length === 0 && <div className="text-center py-20 text-zinc-600 italic">No workouts logged yet.</div>}
              {history.map((item) => (
                <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex flex-col space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold px-1">{item.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.status === 'completed' ? 'bg-green-900/30 text-green-500' : 'bg-orange-900/30 text-orange-500'}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 tabular-nums">
                    <span>{item.date} • {item.startTime}</span>
                    <span>{item.actualMinutes}/{item.targetMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHistory(false)} className="mt-4 w-full py-4 bg-zinc-900 rounded-2xl font-bold text-zinc-400">CLOSE</button>
          </div>
        ) : showSettings ? (
          <div className="w-full h-full animate-in slide-in-from-bottom-4 duration-300 flex flex-col pt-4">
            <h2 className="text-lg font-bold text-zinc-400 mb-6">Settings</h2>
            
            <div className="flex-1 space-y-8 overflow-y-auto pr-1">
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Profile Name</label>
                <input 
                  type="text" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-red-600 transition-all"
                  placeholder="Enter your name"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Default Repetitions</label>
                <div className="flex items-center space-x-4 bg-zinc-900 border border-zinc-800 p-2 rounded-xl">
                  <button onClick={() => setDefaultReps(Math.max(1, defaultReps - 1))} className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-xl font-bold">-</button>
                  <div className="flex-1 text-center font-black text-2xl">{defaultReps}</div>
                  <button onClick={() => setDefaultReps(defaultReps + 1)} className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-xl font-bold">+</button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Default Workout Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['EMOM', 'E2MOM', 'E3MOM', 'E5MOM'] as EMOMVariant[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setDefaultVariant(v)}
                      className={`py-4 rounded-xl font-bold border transition-all ${defaultVariant === v ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setShowSettings(false)} className="mt-8 w-full py-4 bg-zinc-900 rounded-2xl font-bold text-white uppercase tracking-widest active:scale-95 transition-transform">Save & Close</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full">
            {state === TimerState.IDLE ? (
              <div className="flex flex-col items-center justify-center animate-in fade-in duration-700 w-full space-y-12">
                <div className="text-center">
                  <span className="text-zinc-500 text-sm font-semibold uppercase tracking-widest">
                    Hello, <span className="text-zinc-300">{userName}</span>
                  </span>
                  <div className="mt-2 text-zinc-700 text-[10px] font-bold tracking-[0.2em] uppercase">Target Reps</div>
                  <div className="flex items-center justify-center mt-4 w-full max-w-sm">
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => setTargetReps(Math.max(1, targetReps - 5))} className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center active:scale-90 transition-transform text-zinc-400 border border-zinc-800">
                        <span className="text-2xl font-light">-5</span>
                      </button>
                      <button onClick={() => setTargetReps(Math.max(1, targetReps - 1))} className="w-10 h-10 rounded-full bg-zinc-900/50 flex items-center justify-center active:scale-90 transition-transform text-zinc-500 text-xs border border-zinc-800/50">
                        -1
                      </button>
                    </div>
                    <div className="text-8xl font-light tabular-nums px-6 min-w-[140px] text-center">{targetReps}</div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => setTargetReps(targetReps + 1)} className="w-10 h-10 rounded-full bg-zinc-900/50 flex items-center justify-center active:scale-90 transition-transform text-zinc-500 text-xs border border-zinc-800/50">
                        +1
                      </button>
                      <button onClick={() => setTargetReps(targetReps + 5)} className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center active:scale-90 transition-transform text-zinc-400 border border-zinc-800">
                        <span className="text-2xl font-light">+5</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-zinc-600 mt-4 text-sm font-medium">Set duration: {totalDurationMinutes} minutes</p>
                </div>
                
                <div className="flex flex-col items-center space-y-10">
                  <button onClick={startWorkout} className="w-60 h-60 rounded-full bg-red-600 shadow-2xl shadow-red-900/40 flex flex-col items-center justify-center active:scale-95 transition-all">
                    <span className="text-2xl font-bold tracking-[0.15em]">START</span>
                    <span className="text-[10px] opacity-80 uppercase tracking-widest mt-2 font-semibold">MY {variant} SESSION</span>
                  </button>
                  <p className="text-zinc-400 text-sm italic text-center max-w-[320px] leading-relaxed opacity-70 px-4">
                    {dailyFact}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-12 w-full animate-in zoom-in-95 duration-500">
                <div className="relative">
                  <CircularProgress 
                    progress={progress} 
                    isTimerRunning={state === TimerState.RUNNING}
                    color={state === TimerState.PREPARING ? '#fbbf24' : (state === TimerState.PAUSED ? '#4b5563' : '#ef4444')} 
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {state === TimerState.PREPARING ? (
                      <>
                        <span className="text-yellow-500 text-[10px] font-bold mb-1 uppercase tracking-widest">PREPARING</span>
                        <span className="text-8xl font-thin tabular-nums leading-none tracking-tighter text-yellow-500">{prepSeconds}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-zinc-500 text-[10px] font-bold mb-1 uppercase tracking-widest">ROUND {currentRound} / {targetReps}</span>
                        <span className="text-8xl font-thin tabular-nums leading-none tracking-tighter">{formatTime(secondsLeft)}</span>
                        <span className="text-zinc-500 text-[10px] mt-2 uppercase tracking-widest">Time Remaining</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex space-x-6 w-full max-w-xs">
                  <button onClick={resetWorkout} className="flex-1 py-4 rounded-2xl bg-zinc-900/50 text-red-500/80 font-bold active:scale-95 transition-transform border border-zinc-800">QUIT</button>
                  {state !== TimerState.PREPARING && (
                    <button onClick={state === TimerState.RUNNING ? () => setState(TimerState.PAUSED) : () => setState(TimerState.RUNNING)}
                      className={`flex-1 py-4 rounded-2xl font-bold active:scale-95 transition-transform ${state === TimerState.RUNNING ? 'bg-zinc-800 text-white' : 'bg-red-600 text-white'}`}
                    >
                      {state === TimerState.RUNNING ? 'PAUSE' : 'RESUME'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center shrink-0">
        <p className="text-zinc-800 text-[10px] tracking-[0.3em] font-semibold uppercase">Every Minute On The Minute</p>
      </footer>
    </div>
  );
};

export default App;
