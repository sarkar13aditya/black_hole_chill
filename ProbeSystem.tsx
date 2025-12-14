import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import * as THREE from 'three';

// --- THE AUDIO ENGINE FOR PROBES ---
const playLaunchSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContext();
  
  // Oscillator (High Pitch "Pew")
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3); // Pitch Drop

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

// --- SINGLE PROBE COMPONENT ---
// Flies from startPos to Center (0,0,0)
const Probe = ({ startPos, onHit }: { startPos: THREE.Vector3, onHit: () => void }) => {
  const ref = useRef<THREE.Group>(null);
  
  // Calculate Flight Path (Vector towards 0,0,0)
  const direction = useMemo(() => {
    const target = new THREE.Vector3(0, 0, 0);
    return target.sub(startPos).normalize();
  }, [startPos]);

  useFrame((state, delta) => {
    if (ref.current) {
      // 1. Move Forward
      const speed = 25 * delta; // Very fast
      ref.current.position.add(direction.clone().multiplyScalar(speed));
      
      // 2. Rotate (Spinning tech)
      ref.current.rotation.x += delta * 10;
      ref.current.rotation.y += delta * 10;

      // 3. Check Collision (Radius 2.6 is the hole)
      if (ref.current.position.length() < 3.0) {
        onHit(); // Die when hitting the horizon
      }
    }
  });

  return (
    <group ref={ref} position={startPos}>
      {/* Visual Trail */}
      <Trail width={3} length={6} color="#00ffff" attenuation={(t) => t * t}>
        <mesh>
          <octahedronGeometry args={[0.3, 0]} /> {/* Diamond Shape */}
          <meshBasicMaterial color="#00ffff" toneMapped={false} />
        </mesh>
      </Trail>
    </group>
  );
};

// --- MAIN SYSTEM ---
export const ProbeSystem = ({ isPinching }: { isPinching: boolean }) => {
  const { camera } = useThree();
  const [probes, setProbes] = useState<{ id: number; pos: THREE.Vector3 }[]>([]);
  const prevPinch = useRef(false);

  useEffect(() => {
    // TRIGGER ON CLICK (Rising Edge)
    // Only fire when pinch goes from FALSE -> TRUE
    if (isPinching && !prevPinch.current) {
        
        // 1. Calculate Spawn Position (Slightly below camera, like a weapon mount)
        const spawnPos = camera.position.clone();
        spawnPos.y -= 1.0; 
        
        // 2. Add to State
        setProbes(prev => [...prev, { id: Date.now(), pos: spawnPos }]);
        
        // 3. Play Sound
        playLaunchSound();
    }
    
    // Update ref for next frame
    prevPinch.current = isPinching;
  }, [isPinching, camera]);

  const removeProbe = (id: number) => {
    setProbes(prev => prev.filter(p => p.id !== id));
  };

  return (
    <>
      {probes.map(p => (
        <Probe key={p.id} startPos={p.pos} onHit={() => removeProbe(p.id)} />
      ))}
    </>
  );
};