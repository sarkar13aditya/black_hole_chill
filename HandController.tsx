import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandControllerProps {
  onInput: (x: number, y: number, pinched: boolean) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onInput }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  
  // States
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'ACTIVE' | 'ERROR'>('IDLE');
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [isPinching, setIsPinching] = useState(false);

  // 1. Initialize System
  const startSystem = async () => {
    setStatus('LOADING');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => initAI();
      }
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
    }
  };

  const initAI = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
      );
      
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      
      setStatus('ACTIVE');
      predictWebcam();
      
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
    }
  };

  // 2. Tracking Loop
  const predictWebcam = () => {
    if (videoRef.current && landmarkerRef.current) {
      const startTimeMs = performance.now();
      try {
        const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Index Finger Tip (8)
          const indexTip = landmarks[8];
          const x = (1 - indexTip.x) * 100; 
          const y = indexTip.y * 100;
          
          // Pinch Check (Thumb 4 vs Index 8)
          const thumbTip = landmarks[4];
          const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
          const pinched = distance < 0.1; 

          setCursor({ x, y });
          setIsPinching(pinched);
          onInput(x, y, pinched);
        } 
      } catch (e) {
        // Ignore frame errors
      }
      requestAnimationFrame(predictWebcam);
    }
  };

  return (
    <>
      {/* --- VISIBLE VIDEO FEED (The Pilot Cam) --- */}
      {/* We keep it hidden during IDLE so you don't see a blank box */}
      <div className={`fixed bottom-6 right-6 z-40 transition-opacity duration-500 ${status === 'ACTIVE' ? 'opacity-100' : 'opacity-0'}`}>
        {/* The Frame */}
        <div className="relative border-2 border-cyan-500/50 bg-black/50 p-1 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            
            {/* The Video */}
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                // Mirror the video visually so it matches your hand movement
                className="w-48 h-36 object-cover opacity-80 scale-x-[-1]" 
            />

            {/* Decorative Overlay UI */}
            <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-500">LIVE FEED</div>
            <div className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ${isPinching ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
            
            {/* Scanlines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20" />
        </div>
      </div>

      {/* --- CURSOR (The Red Dot) --- */}
      {status === 'ACTIVE' && (
        <div 
          className={`fixed w-6 h-6 rounded-full border-2 border-white shadow-[0_0_20px_cyan] pointer-events-none z-50 transition-all duration-75 ease-out ${isPinching ? 'bg-white scale-125' : 'bg-transparent scale-100'}`}
          style={{ 
            left: `${cursor.x}%`, 
            top: `${cursor.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/50" />
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white/50" />
        </div>
      )}

      {/* --- INITIALIZE BUTTON --- */}
      {status === 'IDLE' && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
           <div className="text-center">
             <div className="mb-8 font-mono text-cyan-500 tracking-[0.3em] text-xs">NEURAL INTERFACE STANDBY</div>
             <button 
               onClick={startSystem} 
               className="group relative px-8 py-4 bg-transparent border border-cyan-500 text-cyan-500 font-mono tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-300"
             >
               <span className="relative z-10">INITIALIZE LINK</span>
               <div className="absolute inset-0 bg-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
             </button>
           </div>
        </div>
      )}
      
      {/* --- LOADING INDICATOR --- */}
      {status === 'LOADING' && (
        <div className="fixed bottom-10 left-10 flex items-center gap-3 font-mono text-xs text-cyan-500 animate-pulse z-50">
           <div className="w-2 h-2 bg-cyan-500 rounded-full" />
           CALIBRATING SENSORS...
        </div>
      )}
    </>
  );
};
