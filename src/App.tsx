/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Sparkles, 
  Wind, 
  ShieldCheck, 
  Coffee,
  Navigation,
  Send,
  Loader2,
  X,
  Stars,
  Music,
  Play,
  Pause,
  Upload,
  Home,
  PenTool,
  Quote
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const AFFIRMATIONS = import.meta.env.VITE_AFFIRMATIONS ? JSON.parse(import.meta.env.VITE_AFFIRMATIONS) : [
  "أنتي أجمل حاجة حصلت لي في حياتي.",
  "ما تخافيش من أي حاجة، أنا جنبك وهفضل دايماً سندك.",
  "ضحكتك هي اللي بتنور دنيتي، خليكي دايماً مبسوطة.",
  "خدي نفس عميق يا روحي.. كل حاجة هتكون زي ما إنتي عاوزه وأحسن.",
  "أنا معاكي في أصغر تفاصيل يومك وفي أكبر طموحاتك.",
  "قلبي هو بيتك التاني، ومستحيل يتقفل في وشك أبداً.",
  "إنتي قوية ومعدنك أصيل، ومفيش حاجة صعبة عليكي.",
  "غمضي عينيكي.. تخيلي إني ماسك إيدك دلوقتي وبقولك بحبك."
];

export default function App() {
  const [isEntered, setIsEntered] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'space'>('home');
  const [activeAffirmation, setActiveAffirmation] = useState(0);
  const [fallingElements, setFallingElements] = useState<{ id: number; left: number; duration: number; size: number; type: 'heart' | 'sparkle' }[]>([]);

  // Music & Letter State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Initialize Audio from IndexedDB or LocalStorage
  useEffect(() => {
    const initAudio = async () => {
      const savedLink = localStorage.getItem('persistent_audio_url');
      
      // 1. Try to load from IndexedDB first (for uploaded files)
      const request = indexedDB.open('AppAudioDB', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio');
        }
      };

      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const transaction = db.transaction(['audio'], 'readonly');
        const store = transaction.objectStore('audio');
        const getReq = store.get('current_track');

        getReq.onsuccess = () => {
          if (getReq.result instanceof Blob) {
            const url = URL.createObjectURL(getReq.result);
            setAudioUrl(url);
          } else if (savedLink && !savedLink.startsWith('blob:')) {
            // 2. Fallback to direct link if no uploaded file exists
            setAudioUrl(savedLink);
          }
        };
      };
    };

    initAudio();
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [personalLetter, setPersonalLetter] = useState(() => {
    return localStorage.getItem('personal_letter') || import.meta.env.VITE_PERSONAL_LETTER || "انا عارف انك بسبب اهلك مش عارفين نكلم بس انا متفهم ده يا حبيبتي والله ومبسوط علشان على الأقل أنتي معايا، بس متخفيش ولا تحسسي نفسك انك خايفه وأنا جنبك والله";
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    localStorage.setItem('personal_letter', personalLetter);
  }, [personalLetter]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveAffirmation((prev) => (prev + 1) % AFFIRMATIONS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFallingElements(prev => [
        ...prev.slice(-20),
        { 
          id: Date.now() + Math.random(), 
          left: Math.random() * 100, 
          duration: Math.random() * 4 + 4,
          size: Math.random() * 20 + 15,
          type: Math.random() > 0.4 ? 'heart' : 'sparkle'
        }
      ]);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setIsPlaying(false);

      // Save to IndexedDB
      const request = indexedDB.open('AppAudioDB', 1);
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['audio'], 'readwrite');
        const store = transaction.objectStore('audio');
        store.put(file, 'current_track');
        localStorage.removeItem('persistent_audio_url'); // Prefer IDB over link if both exist
      };
    }
  };

  const saveDirectLink = (url: string) => {
    setAudioUrl(url);
    setIsPlaying(true);
    localStorage.setItem('persistent_audio_url', url);
    
    // Clear IndexedDB if we are switching to a link
    const request = indexedDB.open('AppAudioDB', 1);
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const transaction = db.transaction(['audio'], 'readwrite');
      const store = transaction.objectStore('audio');
      store.delete('current_track');
    };
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-love-50 selection:bg-love-200 font-cairo" dir="rtl">
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          loop 
          onPlay={() => setIsPlaying(true)} 
          onPause={() => setIsPlaying(false)} 
          onError={(e) => {
            console.error("Audio playback error:", e);
            // If it's a stale blob URL, clear it to avoid repeated errors
            if (audioUrl.startsWith('blob:')) {
              setAudioUrl(null);
              localStorage.removeItem('persistent_audio_url');
            }
          }}
        />
      )}

      <AnimatePresence>
        {!isEntered && (
          <motion.div
            key="gate"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100, scale: 1.1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-love-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="absolute inset-0 z-0 opacity-20">
               <div className="absolute top-0 left-0 w-64 h-64 bg-love-200 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
               <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-200 rounded-full blur-[120px] translate-x-1/4 translate-y-1/4" />
            </div>

            <div className="relative z-10 space-y-10">
              <motion.h1 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-7xl md:text-9xl text-rose-900 font-bold font-amiri italic tracking-tighter"
              >
                جاهزة؟
              </motion.h1>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEntered(true)}
                className="px-16 py-5 bg-love-500 text-white rounded-full text-3xl font-bold shadow-2xl hover:bg-love-600 transition-all border-4 border-white/20 block mx-auto"
              >
                ادخلي
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* العناصر المتساقطة */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <AnimatePresence>
          {fallingElements.map(el => (
            <motion.div
              key={el.id}
              initial={{ y: -50, opacity: 0, x: `${el.left}%` }}
              animate={{ y: '110vh', opacity: [0, 0.7, 0], rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: el.duration, ease: "linear" }}
              className={`absolute ${el.type === 'heart' ? 'text-love-400' : 'text-yellow-400'}`}
            >
              {el.type === 'heart' ? <Heart size={el.size} fill="currentColor" /> : <Sparkles size={el.size} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/70 backdrop-blur-xl border-2 border-love-100 px-6 py-3 rounded-full flex gap-8 shadow-2xl items-center">
        <button 
          onClick={() => setCurrentPage('home')}
          className={`flex flex-col items-center gap-1 transition-all ${currentPage === 'home' ? 'text-love-500 scale-110' : 'text-rose-300 hover:text-love-400'}`}
        >
          <Home size={24} />
          <span className="text-xs font-bold font-sans">الأساسية</span>
        </button>
        <div className="w-px h-8 bg-love-100" />
        <button 
          onClick={() => setCurrentPage('space')}
          className={`flex flex-col items-center gap-1 transition-all ${currentPage === 'space' ? 'text-love-500 scale-110' : 'text-rose-300 hover:text-love-400'}`}
        >
          <Music size={24} />
          <span className="text-xs font-bold font-sans">الموسيقى</span>
        </button>
      </nav>

      {/* Content Rendering */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {currentPage === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5 }}
              className="pb-24"
            >
              <section className="pt-20 pb-10 px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
                
                <div className="w-full max-w-2xl h-24 md:h-32 flex items-center justify-center bg-white/50 backdrop-blur-lg rounded-[2rem] border-2 border-white/80 shadow-xl px-6 mb-12">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={activeAffirmation}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-xl md:text-4xl text-love-600 text-center font-bold font-amiri italic transition-all duration-500"
                    >
                      {AFFIRMATIONS[activeAffirmation]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Personal Letter Display on Home */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-3xl glass p-8 md:p-12 rounded-[3rem] shadow-2xl relative overflow-hidden group mb-16"
                >
                  <Quote className="absolute top-6 left-6 text-love-100 w-20 h-20 -rotate-12 transition-transform group-hover:rotate-0 duration-700" />
                  <Heart className="absolute bottom-6 right-6 text-rose-50 w-32 h-32 opacity-30 animate-pulse" />
                  
                  <div className="relative z-10 text-center">
                    <div className="flex justify-between items-center mb-6">
                      <div className="w-10 h-10" /> {/* Spacer */}
                      <p className="text-sm font-bold text-love-400 tracking-widest uppercase">رسـالتي الخاصة ليكي</p>
                      <button 
                        onClick={() => {
                          const newText = prompt("اكتب كلامك الجديد هنا يا بطل:", personalLetter);
                          if (newText !== null) setPersonalLetter(newText);
                        }}
                        className="w-10 h-10 rounded-full bg-love-50 flex items-center justify-center text-love-400 hover:bg-love-500 hover:text-white transition-all shadow-sm"
                        title="تعديل الرسالة"
                      >
                        <PenTool size={18} />
                      </button>
                    </div>

                    <p className="text-2xl md:text-5xl italic font-bold text-rose-900 leading-[1.8] font-amiri whitespace-pre-wrap">
                      {personalLetter}
                    </p>
                    
                    <div className="mt-10 flex justify-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-love-200" />
                       <div className="w-12 h-2 rounded-full bg-love-400" />
                       <div className="w-2 h-2 rounded-full bg-love-200" />
                    </div>
                  </div>
                </motion.div>
              </section>

              <main className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                <div className="glass rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-love-200/10 group overflow-hidden relative">
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-love-100/30 rounded-full blur-3xl group-hover:bg-love-200/40 transition-colors" />
                  <Music className="text-love-500 w-12 h-12 mb-6 animate-bounce" />
                  <h2 className="text-3xl md:text-5xl text-love-600 mb-4 font-bold font-amiri">أغنية بسمعها بفكر فيكي على طول.. 🎵</h2>
                  <div className="mt-8 w-full h-1 bg-gradient-to-r from-transparent via-love-200 to-transparent" />
                  <button 
                    onClick={() => setCurrentPage('space')}
                    className="mt-6 text-sm font-bold text-love-400 hover:text-love-600 transition-colors flex items-center gap-2"
                  >
                    اسمعي أغنيتنا من هنا.. <Music size={14} />
                  </button>
                </div>
                <div className="glass rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-love-200/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-love-100/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                  <Heart className="text-love-400 w-10 h-10 mb-6 drop-shadow-sm" />
                  <p className="text-2xl md:text-3xl text-rose-900 font-bold font-amiri leading-loose">
                    {import.meta.env.VITE_SUB_MESSAGE || "انا عارف انك بسبب اهلك مش عارفين نكلم بس انا متفهم ده يا حبيبتي والله ومبسوط علشان على الأقل أنتي معايا، بس متخفيش ولا تحسسي نفسك انك خايفه وأنا جنبك والله"}
                  </p>
                </div>
              </main>


            </motion.div>
          ) : (
            <motion.div
              key="space"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="pt-20 pb-40 px-4 max-w-4xl mx-auto"
            >
              <div className="text-center mb-12">
                <Music className="w-12 h-12 text-love-500 mx-auto mb-4" />
                <h2 className="text-4xl md:text-6xl text-love-600 font-bold mb-4 italic">مساحتنا الخاصة 🕊️</h2>
                <p className="text-lg md:text-2xl text-rose-800/60 font-bold italic">هنا كل حاجة لينا وبس..</p>
              </div>

              <div className="grid grid-cols-1 gap-12">
                {/* Music Section */}
                <div className="bg-white/80 border-2 border-love-100 p-8 rounded-[3rem] shadow-2xl">
                  <h3 className="text-3xl text-love-600 mb-6 font-bold text-center">أغنيتنا المفضلة 🎵</h3>
                  {audioUrl ? (
                    <div className="flex flex-col items-center gap-6">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={togglePlay}
                        className="w-48 h-48 rounded-full bg-love-500 text-white flex items-center justify-center shadow-2xl relative"
                      >
                         <AnimatePresence>
                           {isPlaying && (
                             <motion.div 
                              initial={{ scale: 1, opacity: 0.5 }}
                              animate={{ scale: 1.5, opacity: 0 }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="absolute inset-0 bg-love-400 rounded-full"
                             />
                           )}
                         </AnimatePresence>
                         {isPlaying ? <Pause size={64} /> : <Play size={64} className="mr-2" />}
                      </motion.button>
                      <div className="flex gap-4 mt-4">
                        <button 
                          onClick={() => {
                            const url = prompt("حط رابط الأغنية المباشر هنا (MP3 URL) عشان متتمسحش بعد الريفرش:", audioUrl || "");
                            if (url !== null && url.trim() !== "") {
                              saveDirectLink(url);
                            }
                          }}
                          className="text-sm text-love-500 hover:underline font-bold"
                        >
                          إضافة رابط مباشر 🔗
                        </button>
                        <span className="text-rose-200">|</span>
                        <label className="text-sm text-love-400 cursor-pointer underline font-bold transition-colors hover:text-love-600">
                          تغيير الملف 📁
                          <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                    <div className="text-center py-6 space-y-6">
                      <label className="flex flex-col items-center gap-4 cursor-pointer p-8 border-4 border-dashed border-love-100 rounded-[2.5rem] hover:bg-love-50 transition-all group">
                        <Upload size={48} className="text-love-400 group-hover:scale-110 transition-transform" />
                        <p className="text-xl font-bold text-rose-800/70 leading-relaxed px-4">ارفعي أغنيتنا اللي بتحبي تسمعيها دلوقتي..</p>
                        <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                      </label>
                      <div className="flex items-center gap-4 px-4">
                        <div className="h-px bg-love-100 flex-1" />
                        <span className="text-love-300 font-bold">أو</span>
                        <div className="h-px bg-love-100 flex-1" />
                      </div>
                      <button 
                        onClick={() => {
                          const url = prompt("حط رابط الأغنية المباشر هنا (MP3 URL) عشان تفضل موجودة دايماً:");
                          if (url !== null && url.trim() !== "") {
                            saveDirectLink(url);
                          }
                        }}
                        className="w-full py-4 bg-white border-2 border-love-200 text-love-500 rounded-[1.8rem] font-bold shadow-sm hover:bg-love-50 transition-all flex items-center justify-center gap-2"
                      >
                         استخدمي رابط أغنية <Music size={18} />
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="py-20 px-6 text-center border-t border-love-100 bg-white/40">
        <p className="text-2xl md:text-3xl text-love-500 mb-6 font-bold italic underline decoration-love-200 underline-offset-8">"يا حتـة من قلبي"</p>
        <div className="flex items-center justify-center gap-6 text-rose-300 opacity-60">
           <Heart size={24} fill="currentColor" className="animate-bounce" />
           <Sparkles size={28} />
           <Heart size={24} fill="currentColor" className="animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </footer>
    </div>
  );
}
