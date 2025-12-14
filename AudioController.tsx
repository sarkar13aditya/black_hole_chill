import React, { useEffect, useRef } from 'react';

interface AudioControllerProps {
  pinched: boolean; // Are we zooming in?
}

export const AudioController: React.FC<AudioControllerProps> = ({ pinched }) => {
  // References to the Web Audio Nodes
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);

  // Initialize the Synth Engine
  useEffect(() => {
    // 1. Create Audio Context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // 2. Create Nodes
    // Main Drone (Sawtooth for texture)
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; 
    osc.frequency.value = 55; // Low A note (Deep rumble)

    // LFO (Low Frequency Oscillator) to make the drone "throb" slightly
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2; // Slow pulse
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5; // Modulate pitch slightly

    // Filter (The "Muffle" effect)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1; // Resonance

    // Master Volume
    const gain = ctx.createGain();
    gain.gain.value = 0.0; // Start silent

    // 3. Connect the Cables
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency); // LFO wobbles the pitch
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // 4. Start the Engines
    osc.start();
    lfo.start();

    // Store refs for control loop
    oscRef.current = osc;
    gainRef.current = gain;
    filterRef.current = filter;
    lfoRef.current = lfo;

    return () => {
      // Cleanup on unmount
      osc.stop();
      lfo.stop();
      ctx.close();
    };
  }, []);

  // Control Loop: React to "Pinch" (Zoom) state
  useEffect(() => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    const filter = filterRef.current;
    const osc = oscRef.current;

    if (!ctx || !gain || !filter || !osc) return;

    // BROWSER SAFETY: Audio starts "Suspended". We must resume it on first interaction.
    if (ctx.state === 'suspended' && pinched) {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const rampTime = 2.0; // How long the transition takes (seconds)

    if (pinched) {
      // --- ZOOM IN (THREATENING) ---
      // 1. Volume UP
      gain.gain.setTargetAtTime(0.4, now, 0.5); 
      
      // 2. Filter OPEN (Hear the buzz/distortion)
      filter.frequency.setTargetAtTime(800, now, 0.5); 
      
      // 3. Pitch UP (Engine spin up)
      osc.frequency.setTargetAtTime(65, now, 1.0); 

    } else {
      // --- ZOOM OUT (SAFE) ---
      // 1. Volume DOWN (Quiet rumble)
      gain.gain.setTargetAtTime(0.1, now, 1.0);
      
      // 2. Filter CLOSED (Muffled, deep bass only)
      filter.frequency.setTargetAtTime(100, now, 1.0);
      
      // 3. Pitch DOWN (Engine idle)
      osc.frequency.setTargetAtTime(55, now, 1.0);
    }

  }, [pinched]);

  return null; // This component has no UI, it just makes noise
};