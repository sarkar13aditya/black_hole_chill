import React, { Suspense, useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, PerspectiveCamera, Cloud, Sparkles, Float } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { BlackHole } from './BlackHole';
import { Overlay } from './Overlay';
import { HandController } from './HandController';
import { AudioController } from './AudioController';
import { ProbeSystem } from './ProbeSystem';
import * as THREE from 'three';

// --- ASSETS (Same as before) ---
const ShootingStar = () => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.position.x = (t * 100) % 600 - 300; 
      ref.current.position.y = 150 - (t * 20) % 100;
      ref.current.rotation.z = -0.2;
    }
  });
  return (
    <mesh ref={ref} position={[-200, 100, -100]}>
      <boxGeometry args={[40, 0.4, 0.4]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={1} />
    </mesh>
  );
};

const DistantSolarSystem = () => {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={[-100, 30, -180]} scale={[0.8, 0.8, 0.8]}>
        <mesh>
           <sphereGeometry args={[1.5, 32, 32]} /> 
           <meshBasicMaterial color={[10, 4, 1]} toneMapped={false} />
        </mesh>
        <mesh rotation={[1.3, 0, 0]}>
           <ringGeometry args={[6, 6.2, 64]} />
           <meshBasicMaterial color="#ffffff" opacity={0.15} transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[6, 0, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#0088ff" />
        </mesh>
      </group>
    </Float>
  );
};

// --- CAMERA RIG (Updated with Zoom Physics) ---
const CameraRig: React.FC<{ input: { x: number, y: number, pinched: boolean } }> = ({ input }) => {
  const { camera } = useThree();
  const vec = new THREE.Vector3();
  
  // We use a ref to store the current physical radius so we can drift smoothly
  const currentRadius = useRef(40); // Start FAR away

  useFrame((state) => {
    // 1. Zoom Logic (Thrusters)
    const targetRadius = input.pinched ? 12 : 40; // 12 = Close, 40 = Far
    
    // Smoothly interpolate radius (Drift effect)
    // 0.03 = Slow drift speed
    currentRadius.current = THREE.MathUtils.lerp(currentRadius.current, targetRadius, 0.03);

    // 2. Rotation Logic (Iron Man)
    const theta = (input.x - 50) * 0.1 * -1; 
    const phi = THREE.MathUtils.mapLinear(input.y, 0, 100, 0.1, 3.0);

    // 3. Convert to Coordinates
    const x = currentRadius.current * Math.sin(phi) * Math.sin(theta);
    const y = currentRadius.current * Math.cos(phi);
    const z = currentRadius.current * Math.sin(phi) * Math.cos(theta);

    // 4. Update Camera
    camera.position.lerp(vec.set(x, y, z), 0.1);
    camera.lookAt(0, 0, 0);
  });

  return null;
};

// --- MAIN SCENE ---
const Scene: React.FC<{ input: { x: number, y: number, pinched: boolean } }> = ({ input }) => {
  return (
    <>
      <color attach="background" args={['#020205']} />
      <fogExp2 attach="fog" args={['#020205', 0.008]} />
      
      {/* Default camera is ignored, Rig takes over instantly */}
      <PerspectiveCamera makeDefault position={[0, 0, 40]} fov={45} />
      
      <CameraRig input={input} />
      <ProbeSystem isPinching={input.pinched} />

     
      <BlackHole />
      
      <Stars radius={300} depth={100} count={8000} factor={4} saturation={0} fade speed={0.5} />
      <Stars radius={100} depth={50} count={1000} factor={7} saturation={1} fade speed={1} />
      
      <group position={[20, -20, -60]}>
        <Cloud opacity={0.5} speed={0.1} bounds={[60, 20, 20]} color="#8844ff" /> 
      </group>
      <group position={[-30, 30, -80]}>
        <Cloud opacity={0.4} speed={0.1} bounds={[60, 20, 20]} color="#2266ff" /> 
      </group>

      <Sparkles count={200} scale={20} size={4} speed={0.4} opacity={0.4} color="#a0c0ff" />
      <DistantSolarSystem />
      <ShootingStar />
      
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={1.0} mipmapBlur intensity={1.5} radius={0.4} />
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={0.3} radius={0.8} />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};

// ... imports

export default function App() {
  const [input, setInput] = useState({ x: 50, y: 50, pinched: false });

  return (
    <div className="w-full h-screen bg-black relative">
      <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMappingExposure: 1.0 }}>
        <Suspense fallback={null}>
          <Scene input={input} />
        </Suspense>
      </Canvas>
      
      {/* UPDATE THIS LINE: Pass the input prop */}
      <Overlay input={input} />
      
      <AudioController pinched={input.pinched} />
      <HandController onInput={(x, y, pinched) => setInput({ x, y, pinched })} />
    </div>
  );
}