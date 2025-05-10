"use client";
import { useEffect, useState, useCallback, useRef } from "react";

interface PianoKey {
  key: string;
  note: string;
  frequency: number;
  isBlackKey: boolean;
}

const PIANO_KEYS: PianoKey[] = [
  { key: "z", note: "C4", frequency: 261.63, isBlackKey: false },
  { key: "s", note: "C#4", frequency: 277.18, isBlackKey: true },
  { key: "x", note: "D4", frequency: 293.66, isBlackKey: false },
  { key: "d", note: "D#4", frequency: 311.13, isBlackKey: true },
  { key: "c", note: "E4", frequency: 329.63, isBlackKey: false },
  { key: "v", note: "F4", frequency: 349.23, isBlackKey: false },
  { key: "g", note: "F#4", frequency: 369.99, isBlackKey: true },
  { key: "b", note: "G4", frequency: 392.0, isBlackKey: false },
  { key: "h", note: "G#4", frequency: 415.3, isBlackKey: true },
  { key: "n", note: "A4", frequency: 440.0, isBlackKey: false },
  { key: "j", note: "A#4", frequency: 466.16, isBlackKey: true },
  { key: "m", note: "B4", frequency: 493.88, isBlackKey: false },
  { key: ",", note: "C5", frequency: 523.25, isBlackKey: false },
  { key: "l", note: "C#5", frequency: 554.37, isBlackKey: true },
  { key: ".", note: "D5", frequency: 587.33, isBlackKey: false },
  { key: ";", note: "D#5", frequency: 622.25, isBlackKey: true },
  { key: "/", note: "E5", frequency: 659.25, isBlackKey: false },
];

const Piano = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [oscillators, setOscillators] = useState<{
    [key: string]: OscillatorNode;
  }>({});
  const [gainNodes, setGainNodes] = useState<{ [key: string]: GainNode }>({});

  // Effects state
  const [delayNode, setDelayNode] = useState<DelayNode | null>(null);
  const [reverbNode, setReverbNode] = useState<ConvolverNode | null>(null);
  const [masterGainNode, setMasterGainNode] = useState<GainNode | null>(null);

  // Effect controls
  const [delayTime, setDelayTime] = useState<number>(0.3);
  const [delayFeedback, setDelayFeedback] = useState<number>(0.3);
  const [reverbLevel, setReverbLevel] = useState<number>(0.3);
  const [masterVolume, setMasterVolume] = useState<number>(0.7);
  const [transpose, setTranspose] = useState<number>(0);
  const [waveform, setWaveform] = useState<OscillatorType>("sine");

  // Effects nodes refs to persist connections
  const delayFeedbackNode = useRef<GainNode | null>(null);
  const wetGainNode = useRef<GainNode | null>(null);
  const dryGainNode = useRef<GainNode | null>(null);

  useEffect(() => {
    const ctx = new AudioContext();
    setAudioContext(ctx);

    // Create master gain node
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.value = masterVolume;
    setMasterGainNode(masterGain);

    // Create delay network
    const delay = ctx.createDelay(2.0);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const dry = ctx.createGain();

    delay.delayTime.value = delayTime;
    feedback.gain.value = delayFeedback;
    wet.gain.value = 0.3;
    dry.gain.value = 0.7;

    // Configure delay network
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);

    // Store nodes for later use
    setDelayNode(delay);
    delayFeedbackNode.current = feedback;
    wetGainNode.current = wet;
    dryGainNode.current = dry;

    // Connect wet and dry to master
    wet.connect(masterGain);
    dry.connect(masterGain);

    // Create reverb
    createReverb(ctx).then((convolver) => {
      convolver.connect(masterGain);
      setReverbNode(convolver);
    });

    return () => {
      ctx.close();
    };
  }, []);

  // Create reverb impulse response
  const createReverb = async (ctx: AudioContext) => {
    const convolver = ctx.createConvolver();

    // Create impulse response
    const length = ctx.sampleRate * 3; // 3 seconds
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
      }
    }

    convolver.buffer = impulse;
    return convolver;
  };

  const stopNote = useCallback(
    (key: string) => {
      const oscillator = oscillators[key];
      const gainNode = gainNodes[key];

      if (oscillator && gainNode && audioContext) {
        gainNode.gain.setValueAtTime(
          gainNode.gain.value,
          audioContext.currentTime
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.1
        );
        setTimeout(() => {
          try {
            oscillator.stop();
          } catch (e) {
            console.warn("Could not stop oscillator:", e);
          }
          delete oscillators[key];
          delete gainNodes[key];
        }, 100);
      }
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [audioContext, gainNodes, oscillators]
  );

  const playNote = useCallback(
    (key: PianoKey) => {
      if (!audioContext) return;

      // If the note is already playing, stop it first
      if (oscillators[key.key]) {
        stopNote(key.key);
      }
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Connect through effect chain
      oscillator.connect(gainNode);

      if (dryGainNode.current && wetGainNode.current && delayNode) {
        gainNode.connect(dryGainNode.current);
        gainNode.connect(delayNode);
      } else {
        gainNode.connect(masterGainNode || audioContext.destination);
      }

      if (reverbNode) {
        gainNode.connect(reverbNode);
      }

      oscillator.type = waveform;
      // Apply transpose
      const transposedFreq = key.frequency * Math.pow(2, transpose / 12);
      oscillator.frequency.setValueAtTime(
        transposedFreq,
        audioContext.currentTime
      );

      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

      oscillator.start();

      setOscillators((prev) => ({ ...prev, [key.key]: oscillator }));
      setGainNodes((prev) => ({ ...prev, [key.key]: gainNode }));
      setActiveKeys((prev) => new Set([...prev, key.key]));
    },
    [audioContext, oscillators, stopNote]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const pianoKey = PIANO_KEYS.find((k) => k.key === key);
      if (pianoKey && !activeKeys.has(key)) {
        playNote(pianoKey);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (activeKeys.has(key)) {
        stopNote(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeKeys, playNote, stopNote]);

  const handleMouseDown = (key: PianoKey) => {
    if (!audioContext) {
      // Initialize audio context on first interaction
      const newContext = new AudioContext();
      setAudioContext(newContext);
      setTimeout(() => playNote(key), 0);
    } else {
      playNote(key);
    }
  };

  const handleMouseUp = (key: string) => {
    stopNote(key);
  };

  const handleTouchStart = (e: React.TouchEvent, key: PianoKey) => {
    e.preventDefault(); // Prevent default touch behavior
    handleMouseDown(key);
  };

  const handleTouchEnd = (e: React.TouchEvent, key: string) => {
    e.preventDefault();
    handleMouseUp(key);
  };
  // Effect parameter handlers
  const updateDelayTime = useCallback(
    (value: number) => {
      setDelayTime(value);
      if (delayNode) {
        delayNode.delayTime.setValueAtTime(
          value,
          audioContext?.currentTime || 0
        );
      }
    },
    [delayNode, audioContext]
  );

  const updateDelayFeedback = useCallback(
    (value: number) => {
      setDelayFeedback(value);
      if (delayFeedbackNode.current) {
        delayFeedbackNode.current.gain.setValueAtTime(
          value,
          audioContext?.currentTime || 0
        );
      }
    },
    [audioContext]
  );

  const updateReverbLevel = useCallback(
    (value: number) => {
      setReverbLevel(value);
      if (reverbNode && masterGainNode) {
        reverbNode.connect(masterGainNode);
      }
    },
    [reverbNode, masterGainNode]
  );

  const updateMasterVolume = useCallback(
    (value: number) => {
      setMasterVolume(value);
      if (masterGainNode) {
        masterGainNode.gain.setValueAtTime(
          value,
          audioContext?.currentTime || 0
        );
      }
    },
    [masterGainNode, audioContext]
  );

  return (
    <div className="p-8 select-none">
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Waveform selector */}
        <div className="p-4 bg-white rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Waveform
          </label>
          <select
            className="w-full p-2 border rounded"
            value={waveform}
            onChange={(e) => setWaveform(e.target.value as OscillatorType)}
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
          </select>
        </div>

        {/* Transpose control */}
        <div className="p-4 bg-white rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transpose: {transpose} semitones
          </label>
          <input
            type="range"
            min="-12"
            max="12"
            value={transpose}
            onChange={(e) => setTranspose(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Effects controls */}
        <div className="p-4 bg-white rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delay: {Math.round(delayTime * 1000)}ms
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={delayTime}
            onChange={(e) => updateDelayTime(Number(e.target.value))}
            className="w-full mb-4"
          />
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Feedback: {Math.round(delayFeedback * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.01"
            value={delayFeedback}
            onChange={(e) => updateDelayFeedback(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Master volume and reverb */}
        <div className="p-4 bg-white rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reverb: {Math.round(reverbLevel * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={reverbLevel}
            onChange={(e) => updateReverbLevel(Number(e.target.value))}
            className="w-full mb-4"
          />
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Master: {Math.round(masterVolume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => updateMasterVolume(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="relative inline-flex">
        {PIANO_KEYS.map((key) => (
          <div
            key={key.key}
            className={`
              ${
                key.isBlackKey
                  ? "bg-black text-white w-12 h-32 -mx-6 z-10 hover:bg-gray-800"
                  : "bg-white text-black w-16 h-48 border border-gray-300 hover:bg-gray-100"
              } 
              ${
                activeKeys.has(key.key)
                  ? key.isBlackKey
                    ? "bg-gray-700"
                    : "bg-gray-200"
                  : ""
              }
              flex flex-col items-center justify-end pb-4 relative cursor-pointer
              transition-colors duration-75
            `}
            onMouseDown={() => handleMouseDown(key)}
            onMouseUp={() => handleMouseUp(key.key)}
            onMouseLeave={() => handleMouseUp(key.key)}
            onTouchStart={(e) => handleTouchStart(e, key)}
            onTouchEnd={(e) => handleTouchEnd(e, key.key)}
          >
            <span className="text-sm font-medium">{key.key.toUpperCase()}</span>
            <span className="text-xs opacity-50">{key.note}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center text-gray-600">
        Play with your keyboard, mouse, or touch!
      </div>
    </div>
  );
};

export default Piano;
