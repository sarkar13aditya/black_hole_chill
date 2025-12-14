import React, { useEffect, useState } from 'react';

interface OverlayProps {
  input: { x: number; y: number; pinched: boolean };
}

export const Overlay: React.FC<OverlayProps> = ({ input }) => {
  const [time, setTime] = useState('');

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate pseudo-science numbers based on input
  const gravity = input.pinched ? '98.4 G' : '1.2 G';
  const distance = input.pinched ? '12.000 AU' : '40.000 AU';
  const color = input.pinched ? 'text-red-500' : 'text-cyan-400';
  const borderColor = input.pinched ? 'border-red-500' : 'border-cyan-400';

  return (
    <div className={`pointer-events-none absolute inset-0 p-8 flex flex-col justify-between overflow-hidden transition-colors duration-500 ${color}`}>
      
      {/* --- TOP HEADER --- */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase font-mono">
            SINGULARITY
            <span className="text-xs ml-2 align-top opacity-50">MK-IV</span>
          </h1>
          <div className="text-xs font-mono opacity-70 mt-1">
            SECTOR 7G // INTERSTELLAR SIMULATION
          </div>
        </div>
        
        <div className="text-right font-mono text-xs opacity-80">
          <div>SYS_TIME: {time}</div>
          <div>FPS_LOCK: 60</div>
          <div className={`${input.pinched ? 'animate-pulse text-red-500 font-bold' : ''}`}>
             STATUS: {input.pinched ? 'THRUSTERS ENGAGED' : 'ORBITAL DRIFT'}
          </div>
        </div>
      </div>

      {/* --- CENTER RETICLE (Moves slightly with mouse) --- */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out opacity-40"
        style={{ 
          transform: `translate(-50%, -50%) translate(${(input.x - 50) * 0.5}px, ${(input.y - 50) * 0.5}px)` 
        }}
      >
        <div className={`w-[300px] h-[300px] border border-dashed rounded-full flex items-center justify-center ${borderColor} transition-all duration-500 ${input.pinched ? 'scale-75 rotate-90' : 'scale-100 rotate-0'}`}>
           <div className="w-2 h-2 bg-current rounded-full" />
        </div>
      </div>

      {/* --- BOTTOM DASHBOARD --- */}
      <div className="flex justify-between items-end font-mono text-xs">
        
        {/* Left Data Block */}
        <div className="space-y-1">
          <div className="flex gap-4">
            <span className="opacity-50">COORDINATES</span>
            <span>X:{input.x.toFixed(2)} Y:{input.y.toFixed(2)}</span>
          </div>
          <div className="flex gap-4">
            <span className="opacity-50">DISTANCE</span>
            <span>{distance}</span>
          </div>
          <div className="w-32 h-1 bg-gray-800 mt-2">
            <div 
              className={`h-full transition-all duration-300 ${input.pinched ? 'bg-red-500 w-full' : 'bg-cyan-400 w-1/4'}`} 
            />
          </div>
        </div>

        {/* Right Warning Block */}
        <div className="text-right">
           <div className="text-2xl font-bold">{gravity}</div>
           <div className="opacity-50">GRAVITATIONAL FORCE</div>
           {input.pinched && (
             <div className="mt-2 text-red-500 border border-red-500 px-2 py-1 animate-pulse bg-red-500/10">
               ⚠ WARNING: EVENT HORIZON PROXIMITY
             </div>
           )}
        </div>
      </div>

      {/* Decorative Corners */}
      <div className={`absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 ${borderColor}`} />
      <div className={`absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 ${borderColor}`} />
      <div className={`absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 ${borderColor}`} />
      <div className={`absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 ${borderColor}`} />
      
      {/* Scan Lines */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay"></div>
    </div>
  );
};