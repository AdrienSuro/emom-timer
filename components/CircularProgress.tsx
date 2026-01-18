
import React from 'react';

interface CircularProgressProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  isTimerRunning?: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ 
  progress, 
  size = 280, 
  strokeWidth = 12,
  color,
  isTimerRunning = false
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  // Logic for the progressive red saturation (INVERTED)
  // We start at strong saturated red and move to a dimmed greyish-red.
  
  // If a specific color is passed (like yellow for prep), we use it.
  // Otherwise, we calculate the dynamic red.
  const getDynamicColor = () => {
    if (color && color !== '#ef4444') return color;
    if (!isTimerRunning) return color || '#ef4444';

    // Interpolate between saturated red and dimmed grey-red
    // Saturated Red (Progress 0): rgb(239, 68, 68)
    // Grayish Red (Progress 1): rgb(75, 60, 60)
    const r = Math.floor(239 - (239 - 75) * progress);
    const g = Math.floor(68 - (68 - 60) * progress);
    const b = Math.floor(68 - (68 - 60) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const currentColor = getDynamicColor();

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f2937"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={currentColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s linear' }}
        />
      </svg>
    </div>
  );
};

export default CircularProgress;
