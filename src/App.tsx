import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, RotateCcw, Loader2, Trophy, Trash2, Volume2, VolumeX } from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';

interface Winner {
  id: string;
  number: string;
  user: string;
  timestamp: string;
}

interface Entry {
  number: number;
  user: string;
}

export default function LuckyNumberGenerator() {
  const defaultSettings = {
    digits: 3,
    minValue: 0,
    maxValue: 999,
    bgImage: './background.png',
    logoImage: '',
    generatingSound: '',
    finishSound: './finishsound.mp3',
    bgSound: './backgroundSound.mp3',
    bgFit: 'cover',
    logoHeight: 64,
    primaryColor: '#08bcd4',
    secondaryColor: '#ffffff',
    fontSize: 140,
    generatingTime: 1500,
    digitStopDelay: 300
  };

  const [settings, setSettings] = useState(defaultSettings);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [remainingEntries, setRemainingEntries] = useState<Entry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalNumber, setFinalNumber] = useState('');
  const [finalUser, setFinalUser] = useState('');
  const [animatingDigits, setAnimatingDigits] = useState<string[]>([]);
  const [stoppedDigits, setStoppedDigits] = useState<number[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);

  const intervalRefs = useRef<number[]>([]);
  const generatingSoundRef = useRef<HTMLAudioElement>(null);
  const finishSoundRef = useRef<HTMLAudioElement>(null);
  const bgSoundRef = useRef<HTMLAudioElement>(null);

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const handleSettingChange = (key: string, value: string | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      handleSettingChange(key, url);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target) return;
      const data = new Uint8Array(event.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: ['number', 'user'] }) as unknown[];
      const validEntries = (json.slice(1) as Array<{ number: number; user: string }>).map(row => ({
        number: row.number,
        user: row.user
      }));

      // Auto-detect max digits
      if (validEntries.length > 0) {
        const maxNum = Math.max(...validEntries.map(e => e.number));
        const detectedDigits = maxNum.toString().length;
        setSettings(prev => ({ ...prev, digits: detectedDigits, maxValue: Math.pow(10, detectedDigits) - 1, minValue: 0 }));
      }

      setEntries(validEntries);
      setRemainingEntries(validEntries);
    };
    reader.readAsArrayBuffer(file);
  };

  const generateRandomNumber = (excludedNumbers: string[]) => {
    const { minValue, maxValue, digits } = settings;
    const totalPossible = maxValue - minValue + 1;

    // Safety check if all possible numbers are drawn
    if (excludedNumbers.length >= totalPossible) {
      return null;
    }

    let attempts = 0;
    while (attempts < 1000) {
      const num = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
      const formatted = num.toString().padStart(digits, '0');
      if (!excludedNumbers.includes(formatted)) {
        return formatted;
      }
      attempts++;
    }
    return null; // Should rarely happen unless range is very tight
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    setEntries([]);
    setRemainingEntries([]);
    setFinalNumber('');
    setFinalUser('');
    setAnimatingDigits([]);
    setStoppedDigits([]);
    setWinners([]);
    intervalRefs.current.forEach(interval => clearInterval(interval));
    intervalRefs.current = [];
    if (generatingSoundRef.current) {
      generatingSoundRef.current.pause();
      generatingSoundRef.current.currentTime = 0;
    }
  };


  const startGeneration = () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setFinalNumber('');
    setFinalUser('');
    setStoppedDigits([]);

    // Play generating sound
    if (isSoundEnabled && settings.generatingSound && generatingSoundRef.current) {
      generatingSoundRef.current.currentTime = 0;
      generatingSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
    }

    // Clear any existing intervals
    intervalRefs.current.forEach(interval => clearInterval(interval));
    intervalRefs.current = [];

    // Initialize animating digits
    const initialDigits = Array(settings.digits).fill('0');
    setAnimatingDigits(initialDigits);

    // Generate final number - either from Excel or random
    let final = '';
    let userName = '';

    if (remainingEntries.length > 0) {
      // Use Excel list
      const index = Math.floor(Math.random() * remainingEntries.length);
      const luckyEntry = remainingEntries[index];
      final = luckyEntry.number.toString().padStart(settings.digits, '0');
      userName = luckyEntry.user;
      setRemainingEntries(remainingEntries.filter((_, i) => i !== index));
    } else {
      // Random generation
      const randomFinal = generateRandomNumber(winners.map(w => w.number));
      if (randomFinal === null) {
        alert('All possible lucky numbers in this range have been drawn!');
        setIsGenerating(false);
        return;
      }
      final = randomFinal;
    }

    // We will add to history only after animation finishes
    const finalDigits = final.split('');

    // Create intervals for each digit slot
    initialDigits.forEach((_, index) => {
      const interval = setInterval(() => {
        setAnimatingDigits(prev => {
          const newDigits = [...prev];
          newDigits[index] = Math.floor(Math.random() * 10).toString();
          return newDigits;
        });
      }, 50);
      intervalRefs.current.push(interval);
    });

    // Stop digits sequentially from right to left (end to start)
    const stopDelay = settings.digitStopDelay;
    for (let i = settings.digits - 1; i >= 0; i--) {
      const delay = (settings.digits - 1 - i) * stopDelay;
      setTimeout(() => {
        // Stop this digit's interval
        if (intervalRefs.current[i]) {
          clearInterval(intervalRefs.current[i]);
        }

        // Set final value for this digit
        setAnimatingDigits(prev => {
          const newDigits = [...prev];
          newDigits[i] = finalDigits[i];
          return newDigits;
        });

        // Mark this digit as stopped
        setStoppedDigits(prev => [...prev, i]);

        // If this is the last digit to stop
        if (i === 0) {
          setTimeout(() => {
            setFinalNumber(final);
            setFinalUser(userName);
            setIsGenerating(false);

            // Stop generating sound and play finish sound
            if (generatingSoundRef.current) {
              generatingSoundRef.current.pause();
              generatingSoundRef.current.currentTime = 0;
            }

            if (isSoundEnabled && settings.finishSound && finishSoundRef.current) {
              finishSoundRef.current.currentTime = 0;
              finishSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
            }

            // Trigger celebration
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: [settings.primaryColor, settings.secondaryColor, '#ffffff']
            });

            // Add to winners history
            const newWinner: Winner = {
              id: Date.now().toString(),
              number: final,
              user: userName || 'Random Guest',
              timestamp: new Date().toLocaleTimeString()
            };
            setWinners(prev => [newWinner, ...prev]);
          }, 200);
        }
      }, settings.generatingTime + delay);
    }
  };

  useEffect(() => {
    const activeSounds = [bgSoundRef.current, generatingSoundRef.current, finishSoundRef.current];

    if (!isSoundEnabled) {
      // Pause all sounds without resetting
      activeSounds.forEach(sound => sound?.pause());
    } else {
      // Resume background sound
      if (bgSoundRef.current && settings.bgSound) {
        bgSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
      }
      // Resume generating sound only if generation is active
      if (isGenerating && generatingSoundRef.current && settings.generatingSound) {
        generatingSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
      }
    }
  }, [isSoundEnabled, settings.bgSound, isGenerating, settings.generatingSound]);

  useEffect(() => {
    const currentGeneratingSound = generatingSoundRef.current;
    const currentBgSound = bgSoundRef.current;

    const handleFirstInteraction = () => {
      if (isSoundEnabled && currentBgSound && currentBgSound.paused) {
        currentBgSound.play().catch(e => console.log('Autoplay play failed:', e));
      }
      // Remove listener after first interaction
      document.removeEventListener('click', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      intervalRefs.current.forEach(interval => clearInterval(interval));
      if (currentGeneratingSound) currentGeneratingSound.pause();
      if (currentBgSound) currentBgSound.pause();
    };
  }, [isSoundEnabled]);

  const displayDigits = animatingDigits.length > 0 ? animatingDigits : (finalNumber ? finalNumber.split('') : Array(settings.digits).fill('0'));

  return (
    <div className="min-h-screen relative overflow-y-auto">
      {/* Fixed Background Overlay */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${settings.bgImage})`,
          backgroundSize: settings.bgFit ?? 'cover',
        }}
      />

      {/* Audio elements */}
      {settings.generatingSound && (
        <audio ref={generatingSoundRef} src={settings.generatingSound} loop />
      )}
      {settings.finishSound && (
        <audio ref={finishSoundRef} src={settings.finishSound} />
      )}
      {settings.bgSound && (
        <audio ref={bgSoundRef} src={settings.bgSound} loop />
      )}

      {/* Animated background pattern */}
      {!settings.bgImage && (
        <div className="fixed inset-0 -z-10 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial- gradient(circle at 25 % 25 %, ${settings.primaryColor} 2px, transparent 2px),
          radial - gradient(circle at 75 % 75 %, ${settings.secondaryColor} 2px, transparent 2px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
      )}

      {/* Logo */}
      {settings.logoImage && (
        <div className="fixed top-8 left-8 z-30">
          <img
            src={settings.logoImage}
            alt="Company Logo"
            className="w-auto object-contain"
            style={{ height: `${settings.logoHeight} px`, maxWidth: '200px' }}
          />
        </div>
      )}

      {/* Settings and Reset Buttons */}
      <div className="fixed top-8 right-8 flex gap-3 z-30">
        <button
          onClick={resetToDefaults}
          className="group relative p-4 rounded-2xl hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${settings.primaryColor}40`,
            boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 20px ${settings.primaryColor}30`
          }}
          title="Reset to Defaults"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <RotateCcw className="relative z-10" style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} size={24} />
        </button>
        <button
          onClick={() => setIsSoundEnabled(!isSoundEnabled)}
          className="group relative p-4 rounded-2xl hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${settings.primaryColor}40`,
            boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 20px ${settings.primaryColor}30`
          }}
          title={isSoundEnabled ? "Disable Sound" : "Enable Sound"}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {isSoundEnabled ? (
            <Volume2 className="relative z-10" style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} size={24} />
          ) : (
            <VolumeX className="relative z-10" style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} size={24} />
          )}
        </button>
        <button
          onClick={() => setShowHistory(true)}
          className="group relative p-4 rounded-2xl hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${settings.primaryColor}40`,
            boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 20px ${settings.primaryColor}30`
          }}
          title="Winner History"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Trophy className="relative z-10" style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} size={24} />
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="group relative p-4 rounded-2xl hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${settings.primaryColor}40`,
            boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 20px ${settings.primaryColor}30`
          }}
          title="Settings"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Settings className="relative z-10" style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} size={24} />
        </button>
      </div>

      {/* Main content wrapper to maintain centering */}
      <div className="min-h-screen flex flex-col items-center justify-center relative z-10 py-20">
        <div className="text-center px-4 w-full max-w-6xl">
          {/* <h1 className="text-6xl md:text-7xl font-bold text-white mb-4 drop-shadow-2xl" style={{
            textShadow: `0 0 40px ${settings.primaryColor}80, 0 4px 20px rgba(0,0,0,0.5)`
          }}>
            C&E Lottery
          </h1> */}
          {/* <p className="text-xl text-gray-300 mb-12">
          </p> */}

          {/* Display Area */}
          <div className="mb-12 min-h-[350px] flex flex-col items-center justify-center">
            <div
              className="flex flex-wrap justify-center mb-8"
              style={{ gap: `${Math.max(16, settings.fontSize / 4)}px` }}
            >
              {displayDigits.map((digit, index) => {
                const isStopped = stoppedDigits.includes(index);
                return (
                  <div
                    key={index}
                    className="relative transition-all duration-300"
                  >
                    <div
                      className="rounded-[40px] shadow-2xl backdrop-blur-md flex items-center justify-center relative overflow-hidden transition-all duration-300"
                      style={{
                        width: `${settings.fontSize * 1.5}px`,
                        height: `${settings.fontSize * 2.2}px`,
                        background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`,
                        border: `${Math.max(4, settings.fontSize / 20)}px solid ${isStopped ? settings.secondaryColor : settings.primaryColor}`,
                        boxShadow: isStopped
                          ? `0 20px 60px rgba(0,0,0,0.3), 0 0 60px ${settings.secondaryColor}80`
                          : `0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${settings.primaryColor}40`,
                        transform: isStopped ? 'scale(1.05)' : 'scale(1)'
                      }}
                    >
                      {/* Glow effect */}
                      <div className="absolute inset-0 opacity-50" style={{
                        background: `radial-gradient(circle at 30% 30%, ${isStopped ? settings.secondaryColor : settings.primaryColor}40 0%, transparent 70%)`
                      }}></div>

                      <span
                        className="font-bold relative z-10 transition-all duration-300"
                        style={{
                          fontSize: `${settings.fontSize}px`,
                          color: isStopped ? settings.secondaryColor : settings.primaryColor,
                          textShadow: isStopped
                            ? `0 0 30px ${settings.secondaryColor}, 0 0 60px ${settings.secondaryColor}80`
                            : `0 0 30px ${settings.primaryColor}, 0 0 60px ${settings.primaryColor}80`,
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                      >
                        {digit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Winner Name Display */}
            {!isGenerating && finalUser && (
              <div className="animate-in fade-in zoom-in duration-500 flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
                <span className="text-4xl font-bold text-white tracking-wide">
                  👤 {finalUser}
                </span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={startGeneration}
            disabled={isGenerating}
            className="group relative w-auto h-[70px] px-16 text-2xl font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 mx-auto transition-all duration-300 shadow-2xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${settings.primaryColor}50`,
              boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 30px ${settings.primaryColor}40`,
              color: '#ffffff'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `linear-gradient(135deg, ${settings.primaryColor}40 0%, ${settings.secondaryColor}40 100%)`
              }}
            />
            {isGenerating && (
              <Loader2 size={32} className="animate-spin relative z-10" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
            )}
            <span className="relative z-10 font-black tracking-wide" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>
              {isGenerating ? 'Generating...' : 'Generate'}
            </span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl flex items-center justify-center z-30 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full border border-gray-700" style={{
            maxHeight: '70vh',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 100px rgba(0,212,255,0.3)'
          }}>
            <div className="flex justify-between items-center p-6 border-b border-gray-700 rounded-t-3xl" style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`
            }}>
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Settings size={32} />
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:scale-110 transition-all rounded-xl shadow-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`,
                  color: '#ffffff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 180px)' }}>
              {/* Number of Digits */}
              <div className={entries.length > 0 ? "opacity-50 pointer-events-none" : ""}>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Number of Digits {entries.length > 0 && "(Locked by Excel)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  disabled={entries.length > 0}
                  value={settings.digits}
                  onChange={(e) => {
                    const digits = parseInt(e.target.value) || 1;
                    handleSettingChange('digits', digits);
                    handleSettingChange('maxValue', Math.pow(10, digits) - 1);
                  }}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Min Value */}
              <div className={entries.length > 0 ? "opacity-50 pointer-events-none" : ""}>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Minimum Value {entries.length > 0 && "(Locked by Excel)"}
                </label>
                <input
                  type="number"
                  disabled={entries.length > 0}
                  value={settings.minValue}
                  onChange={(e) => handleSettingChange('minValue', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Max Value */}
              <div className={entries.length > 0 ? "opacity-50 pointer-events-none" : ""}>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Maximum Value {entries.length > 0 && "(Locked by Excel)"}
                </label>
                <input
                  type="number"
                  disabled={entries.length > 0}
                  value={settings.maxValue}
                  onChange={(e) => handleSettingChange('maxValue', parseInt(e.target.value) || 9999)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Background Image URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Background Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/background.jpg"
                  value={settings.bgImage}
                  onChange={(e) => handleSettingChange('bgImage', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500"
                />
              </div>

              {/* Company Logo URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Company Logo URL
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={settings.logoImage}
                  onChange={(e) => handleSettingChange('logoImage', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500"
                />
              </div>

              {/* Background Fit and Logo Height */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Background Fit
                  </label>
                  <select
                    value={settings.bgFit}
                    onChange={(e) => handleSettingChange('bgFit', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="cover">Cover (Full Screen)</option>
                    <option value="contain">Contain (Show All)</option>
                    <option value="fill">Fill (Stretch)</option>
                    <option value="auto">Original Size</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Logo Max Height: {settings.logoHeight}px
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="300"
                    value={settings.logoHeight}
                    onChange={(e) => handleSettingChange('logoHeight', parseInt(e.target.value) || 20)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Generating Sound URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Generating Sound URL (loops during animation)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/generating.mp3"
                  value={settings.generatingSound}
                  onChange={(e) => handleSettingChange('generatingSound', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500"
                />
              </div>

              {/* Finish Sound URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Finish Sound URL
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/finish.mp3"
                  value={settings.finishSound}
                  onChange={(e) => handleSettingChange('finishSound', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500"
                />
              </div>

              {/* Background Sound URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Background Sound URL (Ambient music)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/ambient.mp3"
                  value={settings.bgSound}
                  onChange={(e) => handleSettingChange('bgSound', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-gray-600 my-4"></div>
              <p className="text-sm text-gray-400 mb-4">Or upload files directly:</p>

              {/* Background Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload Background Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload('bgImage')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload Company Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload('logoImage')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              {/* Generating Sound Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload Generating Sound
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload('generatingSound')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              {/* Finish Sound Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload Finish Sound
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload('finishSound')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              {/* Background Sound Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload Background Sound
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload('bgSound')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              {/* Excel Upload */}
              <div className="border-t border-gray-600 pt-4 mt-4">
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload Excel File (Number & User Name)
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  Excel should have 2 columns: number and user name
                  {entries.length > 0 && ` (${entries.length} entries loaded, ${remainingEntries.length} remaining)`}
                </p>
                <div className="flex gap-3">
                  <input
                    type="file"
                    id="excel-upload"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="excel-upload"
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-center rounded-xl font-semibold cursor-pointer transition-all"
                  >
                    {entries.length > 0 ? 'Change Excel File' : 'Upload Excel File'}
                  </label>
                  {entries.length > 0 && (
                    <button
                      onClick={() => {
                        setEntries([]);
                        setRemainingEntries([]);
                        // Reset file input
                        const input = document.getElementById('excel-upload') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
                    >
                      Clear Data
                    </button>
                  )}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Number Font Size: {settings.fontSize}px
                </label>
                <input
                  type="range"
                  min="40"
                  max="300"
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  style={{
                    accentColor: settings.primaryColor
                  }}
                />
              </div>

              {/* Theme Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer bg-gray-700 border border-gray-600"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor}
                      onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer bg-gray-700 border border-gray-600"
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor}
                      onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Generating Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Animating Time (ms)
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    step="100"
                    value={settings.generatingTime}
                    onChange={(e) => handleSettingChange('generatingTime', parseInt(e.target.value) || 500)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Digit Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="50"
                    value={settings.digitStopDelay}
                    onChange={(e) => handleSettingChange('digitStopDelay', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Primary Color (Animating Numbers)
                </label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                    className="w-16 h-12 rounded-xl cursor-pointer border-2 border-gray-600"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                    className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Secondary Color (Stopped Numbers)
                </label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
                    className="w-16 h-12 rounded-xl cursor-pointer border-2 border-gray-600"
                  />
                  <input
                    type="text"
                    value={settings.secondaryColor}
                    onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
                    className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 bg-gray-900 rounded-b-3xl">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full px-6 py-4 text-lg font-bold rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`,
                  color: '#ffffff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
              >
                Save Settings ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winners History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl flex items-center justify-center z-30 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-700" style={{
            maxHeight: '80vh',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 100px rgba(0,212,255,0.3)'
          }}>
            <div className="flex justify-between items-center p-6 border-b border-gray-700 rounded-t-3xl" style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}30 0%, ${settings.secondaryColor}30 100%)`
            }}>
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Trophy className="text-yellow-400" size={32} />
                Winners History
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirm('Clear all winners history?')) setWinners([]);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-red-400"
                  title="Clear History"
                >
                  <Trash2 size={24} />
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:scale-110 transition-all rounded-xl shadow-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`,
                    color: '#ffffff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
              {winners.length > 0 ? (
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-900 z-10">
                      <tr className="bg-white/10">
                        <th className="px-8 py-5 text-sm font-bold text-gray-300 uppercase tracking-wider">Number</th>
                        <th className="px-8 py-5 text-sm font-bold text-gray-300 uppercase tracking-wider">Winner Name</th>
                        <th className="px-8 py-5 text-sm font-bold text-gray-300 uppercase tracking-wider text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winners.map((winner, idx) => (
                        <tr
                          key={winner.id}
                          className={`group transition-colors ${idx === 0 ? 'bg-white/5' : 'hover:bg-white/5'}`}
                        >
                          <td className="px-8 py-5">
                            <span className="font-mono text-3xl font-bold" style={{
                              color: settings.primaryColor,
                              textShadow: `0 0 20px ${settings.primaryColor}50`
                            }}>
                              {winner.number}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <span className="text-xl text-white font-medium">{winner.user}</span>
                              {idx === 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-bold border border-yellow-500/30">
                                  LATEST
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right text-gray-400 font-mono">
                            {winner.timestamp}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-20">
                  <Trophy size={64} className="mx-auto text-gray-600 mb-4 opacity-20" />
                  <p className="text-gray-400 text-lg">No winners drawn yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div >
  );
}