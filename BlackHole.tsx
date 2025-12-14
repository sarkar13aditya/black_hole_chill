import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// =========================================================
// PART 1: THE ORIGINAL "STACKED" SHADERS (Texture Based)
// =========================================================
const commonVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const diskFragmentShader = `
uniform float uTime;
uniform sampler2D uNoiseTexture;
uniform float uOpacity;
varying vec2 vUv;

void main() {
    vec2 centered = vUv - 0.5;
    float uvRadius = length(centered) * 2.0; 
    float dist = uvRadius * 8.0; 
    float theta = atan(centered.y, centered.x);

    if (dist < 2.6) discard;

    float speed = 15.0 / (dist * dist + 0.1);
    float twistedTheta = theta - uTime * speed * 0.2;
    vec2 stretchedUV = vec2(dist * 0.5, twistedTheta + uTime * 0.2);
    vec4 texColor = texture2D(uNoiseTexture, stretchedUV);
    float gas = texColor.r; 
    
    gas = max(0.0, gas); 
    gas = pow(gas, 2.0); 

    vec3 colWhite = vec3(3.0, 3.0, 3.0); 
    vec3 colGold  = vec3(1.0, 0.8, 0.6); 
    vec3 colRed   = vec3(0.5, 0.1, 0.05); 
    
    vec3 finalColor = vec3(0.0);
    float alpha = 1.0;

    if (dist < 3.5) {
        float t = smoothstep(2.6, 3.5, dist);
        finalColor = mix(colWhite, colGold, t);
        finalColor += gas * 2.0; 
    } else if (dist < 5.0) {
        float t = smoothstep(3.5, 5.0, dist);
        finalColor = mix(colGold, colRed, t);
        finalColor += gas * vec3(1.0, 0.8, 0.2);
    } else {
        float t = smoothstep(5.0, 8.0, dist);
        finalColor = mix(colRed, vec3(0.0), t);
        alpha = 1.0 - t;
    }

    alpha *= (0.4 + 0.6 * gas);
    alpha *= smoothstep(2.6, 2.65, dist); 
    alpha *= uOpacity;
    finalColor = max(vec3(0.0), finalColor);
    
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
}
`;

// =========================================================
// PART 2: THE NEW "PLASMA" SHADERS (Math Based)
// =========================================================
const plasmaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const plasmaFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;

  // Math-based Noise (No texture needed)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv) * 4.0; 
    float angle = atan(uv.y, uv.x);

    // Shape: Start fading IN at 0.9 (just outside the white ring)
    float shape = smoothstep(0.9, 1.2, r) * smoothstep(2.0, 1.4, r);
    if (shape < 0.01) discard;

    // Warp animation
    float spiral = angle + 10.0 / (r + 0.1) - uTime * 0.8;
    float noiseVal = snoise(vec2(spiral * 3.0, r * 2.0 - uTime * 0.5));
    float detail = snoise(vec2(angle * 10.0, r * 10.0 - uTime));

    float intensity = shape * (0.6 + 0.4 * noiseVal + 0.1 * detail);

    // Palette: Deep Interstellar Orange
    vec3 red = vec3(0.4, 0.05, 0.0);
    vec3 orange = vec3(1.0, 0.3, 0.05);
    vec3 white = vec3(1.0, 0.9, 0.8);

    vec3 color = mix(red, orange, smoothstep(0.0, 0.6, intensity));
    color = mix(color, white, smoothstep(0.6, 1.0, intensity));

    gl_FragColor = vec4(color, intensity * 0.8); // 0.8 Opacity to let the original stack show through
  }
`;

// --- PARTICLE SHADERS ---
const particleVertexShader = `
uniform float uTime;
attribute float aRandom;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  float t = mod(uTime * 0.05 + aRandom * 100.0, 1.0);
  float r = mix(9.0, 2.7, t);
  float angle = aRandom * 6.28 + uTime * (10.0 / r);
  float x = cos(angle) * r;
  float z = sin(angle) * r;
  float y = (aRandom - 0.5) * 0.1 * (r * 0.3); 
  vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = (20.0 * aSize) * (1.0 / -mvPosition.z);
  float heat = smoothstep(8.0, 2.8, r);
  vColor = mix(vec3(0.5, 0.1, 0.05), vec3(1.0, 1.0, 1.0), heat);
}
`;

const particleFragmentShader = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  if (d > 0.5) discard;
  float glow = 1.0 - (d * 2.0);
  glow = pow(glow, 3.0);
  gl_FragColor = vec4(vColor, glow * vAlpha);
}
`;

// =========================================================
// HELPERS & COMPONENTS
// =========================================================

function useGeneratedNoise() {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.random() * 255;
        data[i] = data[i + 1] = data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, []);
  return texture;
}

// 1. ORIGINAL STACKED DISK COMPONENT
const AccretionDisk: React.FC<{ scale?: [number, number, number]; opacity?: number; speedFactor?: number; position?: [number, number, number] }> = ({ scale = [1, 1, 1], opacity = 1.0, speedFactor = 1.0, position = [0, 0, 0] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useGeneratedNoise();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNoiseTexture: { value: texture },
    uOpacity: { value: opacity }
  }), [texture, opacity]);

  useFrame((state) => {
    if (meshRef.current) (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime() * speedFactor;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} scale={scale} position={position}>
      <ringGeometry args={[2.6, 8.0, 300, 64]} />
      <shaderMaterial vertexShader={commonVertexShader} fragmentShader={diskFragmentShader} uniforms={uniforms} transparent side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
};

// 2. NEW PLASMA RING COMPONENT (The "Crazy Effect")
const PlasmaRing: React.FC = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  
    useFrame((state) => {
      if (meshRef.current) (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime();
    });
  
    return (
      // Scaled up slightly to 12x12 so it wraps around the inner stack
      <mesh ref={meshRef} rotation={[1.6, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <shaderMaterial
          vertexShader={plasmaVertexShader}
          fragmentShader={plasmaFragmentShader}
          uniforms={uniforms}
          transparent={true}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending} // Additive blending makes it mix with the layers below
          depthWrite={false}
        />
      </mesh>
    );
};

// 3. HALO & PARTICLES
const LensingHalo: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const texture = useGeneratedNoise();
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uNoiseTexture: { value: texture }, uOpacity: { value: 1.0 } }), [texture]);

  useFrame((state) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime();
      meshRef.current.lookAt(camera.position);
    }
  });

  return (
    <mesh ref={meshRef} scale={[1.0, 0.8, 1.0]} position={[0, 0.3, 0]}>
      <ringGeometry args={[2.6, 7.0, 150, 64]} />
      <shaderMaterial vertexShader={commonVertexShader} fragmentShader={diskFragmentShader} uniforms={uniforms} transparent side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
};

const Particles: React.FC = () => {
  const count = 2000;
  const meshRef = useRef<THREE.Points>(null);
  const { positions, randoms, sizes, alphas } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const r = new Float32Array(count);
    const s = new Float32Array(count);
    const a = new Float32Array(count);
    for(let i=0; i<count; i++) {
        p[i*3]=0; p[i*3+1]=0; p[i*3+2]=0;
        r[i] = Math.random(); s[i] = Math.random(); a[i] = Math.random() * 0.4 + 0.1;
    }
    return { positions: p, randoms: r, sizes: s, alphas: a };
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if(meshRef.current) (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aAlpha" count={count} array={alphas} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial vertexShader={particleVertexShader} fragmentShader={particleFragmentShader} uniforms={uniforms} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

// =========================================================
// MAIN EXPORT
// =========================================================
export const BlackHole: React.FC = () => {
  const diskLayers = useMemo(() => {
    return new Array(8).fill(0).map((_, i) => {
      const t = i / 7;
      const scaleVal = 1.0 + t * 0.15;
      const opacity = 0.6 * (1.0 - t) + 0.1 * t;
      const speed = 1.0 + t * 0.5;
      const yOffset = (Math.random() - 0.5) * 0.15;
      return <AccretionDisk key={i} scale={[scaleVal, scaleVal, scaleVal]} opacity={opacity} speedFactor={speed} position={[0, yOffset, 0]} />;
    });
  }, []);

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2.6, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* 1. The Heavy Stack (Body) */}
      {diskLayers}

      {/* 2. The New Plasma Skin (Energy Overlay) */}
      <PlasmaRing />

      {/* 3. The Details */}
      <LensingHalo />
      <Particles />
    </group>
  );
};