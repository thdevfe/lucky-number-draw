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
    digits: 4,
    minValue: 0,
    maxValue: 9999,
    bgImage: '',
    logoImage: '',
    generatingSound: '',
    finishSound: '',
    bgSound: '',
    bgFit: 'cover' as 'cover' | 'contain' | 'fill' | 'auto',
    logoHeight: 64,
    primaryColor: '#00d4ff',
    secondaryColor: '#ff6b6b',
    fontSize: 80,
    generatingTime: 1500,
    digitStopDelay: 300
  };

  const [settings, setSettings] = useState(defaultSettings);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [remainingEntries, setRemainingEntries] = useState<Entry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
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

  const [isSoundEnabled, setIsSoundEnabled] = useState(false);

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
    if (settings.generatingSound && generatingSoundRef.current) {
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

            if (settings.finishSound && finishSoundRef.current) {
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
    if (bgSoundRef.current) {
      if (isSoundEnabled) {
        bgSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
      } else {
        bgSoundRef.current.pause();
      }
    }
  }, [isSoundEnabled, settings.bgSound]);

  useEffect(() => {
    // Store current refs in variables for cleanup
    const currentGeneratingSound = generatingSoundRef.current;
    const currentBgSound = bgSoundRef.current;

    return () => {
      intervalRefs.current.forEach(interval => clearInterval(interval));
      if (currentGeneratingSound) {
        currentGeneratingSound.pause();
      }
      if (currentBgSound) {
        currentBgSound.pause();
      }
    };
  }, []);

  const displayDigits = animatingDigits.length > 0 ? animatingDigits : (finalNumber ? finalNumber.split('') : Array(settings.digits).fill('0'));

  return (
    <div className="min-h-screen relative overflow-y-auto">
      {/* Fixed Background Overlay */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: settings.bgImage
            ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${settings.bgImage})`
            : `linear-gradient(135deg, #1a1a2e 0%, #1a1a2edd 100%)`,
          backgroundSize: settings.bgFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
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
            backgroundImage: `radial-gradient(circle at 25% 25%, ${settings.primaryColor} 2px, transparent 2px),
                             radial-gradient(circle at 75% 75%, ${settings.secondaryColor} 2px, transparent 2px)`,
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
            style={{ height: `${settings.logoHeight}px`, maxWidth: '200px' }}
          />
        </div>
      )}

      {/* Settings and Reset Buttons */}
      <div className="fixed top-8 right-8 flex gap-3 z-30">
        <button
          onClick={resetToDefaults}
          className="p-4 backdrop-blur-md rounded-2xl hover:scale-105 transition-all shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}90 0%, ${settings.secondaryColor}90 100%)`,
            border: '2px solid rgba(255,255,255,0.3)'
          }}
          title="Reset to Defaults"
        >
          <RotateCcw style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} size={28} />
        </button>
        <button
          onClick={() => setIsSoundEnabled(!isSoundEnabled)}
          className="p-4 backdrop-blur-md rounded-2xl hover:scale-105 transition-all shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}90 0%, ${settings.secondaryColor}90 100%)`,
            border: '2px solid rgba(255,255,255,0.3)'
          }}
          title={isSoundEnabled ? "Disable Sound" : "Enable Sound"}
        >
          {isSoundEnabled ? (
            <Volume2 style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} size={28} />
          ) : (
            <VolumeX style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} size={28} />
          )}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-4 backdrop-blur-md rounded-2xl hover:scale-105 transition-all shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor}90 0%, ${settings.secondaryColor}90 100%)`,
            border: '2px solid rgba(255,255,255,0.3)'
          }}
          title="Settings"
        >
          <Settings style={{ color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} size={28} />
        </button>
      </div>

      {/* Main content wrapper to maintain centering */}
      <div className="min-h-screen flex flex-col items-center justify-center relative z-10 py-20">
        <div className="text-center px-4 w-full max-w-6xl">
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-4 drop-shadow-2xl" style={{
            textShadow: `0 0 40px ${settings.primaryColor}80, 0 4px 20px rgba(0,0,0,0.5)`
          }}>
            Lucky Number Generator
          </h1>

          <p className="text-xl text-gray-300 mb-12">
            Generate a {settings.digits}-digit random number ({settings.minValue} - {settings.maxValue})
          </p>

          {/* Display Area */}
          <div className="mb-12 min-h-[350px] flex flex-col items-center justify-center">
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {displayDigits.map((digit, index) => {
                const isStopped = stoppedDigits.includes(index);
                return (
                  <div
                    key={index}
                    className="relative transition-all duration-300"
                  >
                    <div
                      className="rounded-3xl shadow-2xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden transition-all duration-300"
                      style={{
                        width: '140px',
                        height: '180px',
                        background: `linear-gradient(135deg, ${settings.primaryColor}20 0%, ${settings.secondaryColor}20 100%)`,
                        border: `4px solid ${isStopped ? settings.secondaryColor : settings.primaryColor}`,
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
            className="w-72 h-20 text-2xl font-bold rounded-2xl shadow-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 mx-auto"
            style={{
              background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${settings.primaryColor}60`,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {isGenerating && (
              <Loader2 size={32} className="animate-spin" style={{ color: '#ffffff' }} />
            )}
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>

          {/* Winners History Table */}
          {winners.length > 0 && (
            <div className="mt-20 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 w-full max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 px-4">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Trophy className="text-yellow-400" size={32} />
                  Winners History
                </h2>
                <button
                  onClick={() => setWinners([])}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-red-400 transition-all border border-white/10"
                  title="Clear History"
                >
                  <Trash2 size={20} />
                  Clear
                </button>
              </div>

              <div className="rounded-3xl overflow-hidden backdrop-blur-md border border-white/10 bg-white/5 shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
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
            </div>
          )}
        </div>


        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
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
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Number of Digits
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
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
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Minimum Value
                  </label>
                  <input
                    type="number"
                    value={settings.minValue}
                    onChange={(e) => handleSettingChange('minValue', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Max Value */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Maximum Value
                  </label>
                  <input
                    type="number"
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
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                  />
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Number Font Size: {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    value={settings.fontSize}
                    onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    style={{
                      accentColor: settings.primaryColor
                    }}
                  />
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
      </div>
    </div>
  );
}