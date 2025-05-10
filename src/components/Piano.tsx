"use client";
import { useEffect, useState, useCallback } from "react";

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

  useEffect(() => {
    setAudioContext(new AudioContext());
  }, []);

  const playNote = useCallback(
    (key: PianoKey) => {
      if (!audioContext || oscillators[key.key]) return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        key.frequency,
        audioContext.currentTime
      );

      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

      oscillator.start();

      setOscillators((prev) => ({ ...prev, [key.key]: oscillator }));
      setGainNodes((prev) => ({ ...prev, [key.key]: gainNode }));
      setActiveKeys((prev) => new Set([...prev, key.key]));
    },
    [audioContext, oscillators]
  );

  const stopNote = useCallback(
    (key: string) => {
      if (!oscillators[key] || !gainNodes[key]) return;

      gainNodes[key].gain.exponentialRampToValueAtTime(
        0.01,
        audioContext?.currentTime! + 0.1
      );
      oscillators[key].stop(audioContext?.currentTime! + 0.1);

      setTimeout(() => {
        setOscillators((prev) => {
          const newOsc = { ...prev };
          delete newOsc[key];
          return newOsc;
        });
        setGainNodes((prev) => {
          const newGain = { ...prev };
          delete newGain[key];
          return newGain;
        });
      }, 100);

      setActiveKeys((prev) => {
        const newSet = new Set([...prev]);
        newSet.delete(key);
        return newSet;
      });
    },
    [audioContext, oscillators, gainNodes]
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

  return (
    <div className="p-8 select-none">
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
