import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandControllerProps {
  onInput: (x: number, y: number, pinched: boolean) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onInput }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  
  // Debug State
  const [logs, setLogs] = useState<string[]>(["System Initialized..."]);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [isPinching, setIsPinching] = useState(false);
  const [active, setActive] = useState(false);

  // Helper to add logs to screen
  const log = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 5));

  const startCamera = async () => {
    log("Requesting Camera Access...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } // Request standard size
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
            log("Camera Feed Active. Loading AI...");
            initAI();
        };
      }
    } catch (err) {
      log("Error: Camera Access Denied");
      console.error(err);
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
          delegate: "GPU" // Try GPU first
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      
      log("AI Model Loaded! Starting Tracking Loop...");
      setActive(true);
      predictWebcam();
      
    } catch (err) {
      log("Error: AI Failed to Load");
      console.error(err);
    }
  };

  const predictWebcam = () => {
    if (videoRef.current && landmarkerRef.current) {
      const startTimeMs = performance.now();
      
      try {
        const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Track Index Finger Tip (8)
          const indexTip = landmarks[8];
          const x = (1 - indexTip.x) * 100; // Mirror X
          const y = indexTip.y * 100;
          
          // Pinch Detection (Distance between Thumb(4) and Index(8))
          const thumbTip = landmarks[4];
          const d = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
          const pinched = d < 0.1; // Threshold

          setCursor({ x, y });
          setIsPinching(pinched);
          onInput(x, y, pinched);
        } 
      } catch (e) {
        // Sometimes GPU context is lost, ignore single frame errors
      }
      
      requestAnimationFrame(predictWebcam);
    }
  };

  return (
    <>
      {/* 1. VISIBLE VIDEO (For Debugging - Bottom Right) */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="fixed bottom-0 right-0 w-48 h-36 border-2 border-red-500 opacity-50 z-50 pointer-events-none" 
      />

      {/* 2. DEBUG LOGS (Bottom Left) */}
      <div className="fixed bottom-20 left-10 z-50 font-mono text-xs text-green-400 bg-black/80 p-4 border border-green-500 rounded">
        <h3 className="font-bold underline mb-2">DIAGNOSTICS</h3>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
        <div className="mt-2 text-white">
           Tracking: {active ? "ON" : "OFF"} <br/>
           Cursor: {cursor.x.toFixed(0)}, {cursor.y.toFixed(0)} <br/>
           Pinch: {isPinching ? "YES" : "NO"}
        </div>
      </div>

      {/* 3. THE RED DOT */}
      {active && (
        <div 
          className={`fixed w-4 h-4 rounded-full border-2 border-white shadow-[0_0_15px_red] pointer-events-none z-50 transition-all duration-75 ease-out ${isPinching ? 'bg-white scale-150' : 'bg-red-500 scale-100'}`}
          style={{ 
            left: `${cursor.x}%`, 
            top: `${cursor.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      )}

      {/* 4. START BUTTON */}
      {!active && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
           <button 
             onClick={startCamera} 
             className="px-8 py-3 bg-red-600 text-white font-bold rounded hover:bg-red-500"
           >
             START DEBUG MODE
           </button>
        </div>
      )}
    </>
  );
};
