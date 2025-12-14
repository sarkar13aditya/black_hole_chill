import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandControllerProps {
  onInput: (x: number, y: number, pinched: boolean) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onInput }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // States: IDLE -> LOADING -> CAMERA_ACTIVE (or MOUSE_FALLBACK)
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'CAMERA_ACTIVE' | 'MOUSE_FALLBACK'>('IDLE');
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [isPinching, setIsPinching] = useState(false);
  
  // AI Brain Storage
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const pinchRef = useRef(false);

  // ==========================================================
  // 1. MOUSE MODE (Backup System)
  // ==========================================================
  useEffect(() => {
    if (status === 'MOUSE_FALLBACK') {
      const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        setCursor({ x, y });
        // Send data immediately
        onInput(x, y, pinchRef.current);
      };
      const handleMouseDown = () => {
        pinchRef.current = true;
        setIsPinching(true);
        onInput(cursor.x, cursor.y, true);
      };
      const handleMouseUp = () => {
        pinchRef.current = false;
        setIsPinching(false);
        onInput(cursor.x, cursor.y, false);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [status, onInput, cursor.x, cursor.y]); // Added deps to silence linter

  // ==========================================================
  // 2. CAMERA MODE (The Real Iron Man Tech)
  // ==========================================================
  const startCamera = async () => {
    setStatus('LOADING');
    try {
      // A. Request Camera Access
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", () => predictWebcam());
      }

      // B. Load Google MediaPipe AI
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

      setStatus('CAMERA_ACTIVE');

    } catch (err) {
      console.error("Camera Access Failed:", err);
      // Auto-fallback if permission denied
      setStatus('MOUSE_FALLBACK'); 
    }
  };

  const predictWebcam = () => {
    if (status === 'MOUSE_FALLBACK') return;

    if (videoRef.current && landmarkerRef.current) {
      const startTimeMs = performance.now();
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // 1. TRACKING (Index Finger Tip #8)
        const indexTip = landmarks[8];
        const x = (1 - indexTip.x) * 100; // Mirror effect
        const y = indexTip.y * 100;
        
        // 2. GESTURE (Pinch Detection)
        // Measure distance between Thumb Tip (#4) and Index Tip (#8)
        const thumbTip = landmarks[4];
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        // If fingers are close (< 0.05), count as a "Click"
        const pinched = distance < 0.05; 

        setCursor({ x, y });
        setIsPinching(pinched);
        onInput(x, y, pinched);
      }
      requestAnimationFrame(predictWebcam);
    }
  };

  // ==========================================================
  // UI RENDER
  // ==========================================================
  return (
    <>
      {/* Invisible Video Element (Required for AI) */}
      <video ref={videoRef} autoPlay playsInline className="absolute top-0 left-0 opacity-0 pointer-events-none -z-10 w-64 h-48" />

      {/* Red Dot Cursor */}
      {(status === 'CAMERA_ACTIVE' || status === 'MOUSE_FALLBACK') && (
        <div 
          className={`fixed w-4 h-4 rounded-full border-2 border-white shadow-[0_0_15px_red] pointer-events-none z-50 transition-all duration-75 ease-out ${isPinching ? 'bg-white scale-150' : 'bg-red-500 scale-100'}`}
          style={{ 
            left: `${cursor.x}%`, 
            top: `${cursor.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      )}

      {/* Start Button */}
      {status === 'IDLE' && (
        <div className="fixed inset-0 flex items-end justify-center pb-10 pointer-events-none z-50">
           <button onClick={startCamera} className="pointer-events-auto px-8 py-3 bg-white/10 border border-orange-500 text-orange-500 font-mono backdrop-blur-md hover:bg-orange-500 hover:text-black transition-all">
             INITIALIZE NEURAL INTERFACE
           </button>
        </div>
      )}
      
      {/* Loading Spinner */}
      {status === 'LOADING' && (
        <div className="fixed bottom-10 left-10 text-orange-500 font-mono animate-pulse z-50">
           LOADING VISION MODELS...
        </div>
      )}

      {/* Status HUD */}
      {(status === 'CAMERA_ACTIVE' || status === 'MOUSE_FALLBACK') && (
        <div className="fixed bottom-10 left-10 font-mono text-xs opacity-80 pointer-events-none z-40">
          <p className="text-cyan-500">
             SYSTEM: {status === 'CAMERA_ACTIVE' ? 'HAND TRACKING' : 'MOUSE EMULATION'}
          </p>
          <p className={isPinching ? "text-red-500 font-bold" : "text-gray-500"}>
            TRIGGER: {isPinching ? "ENGAGED" : "READY"}
          </p>
        </div>
      )}
    </>
  );
};