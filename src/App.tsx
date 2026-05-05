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
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  serverTimestamp,
  addDoc,
  collection
} from 'firebase/firestore';
import { db } from './lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {}, // We are not using auth for now based on simplicity request, but function is required
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
  const [currentQuestion, setCurrentQuestion] = useState(-1); // -1 means initial "Ready?" screen
  const [userAnswers, setUserAnswers] = useState<string[]>(new Array(5).fill(""));
  const [fallingElements, setFallingElements] = useState<{ id: number; left: number; duration: number; size: number; type: 'heart' | 'sparkle' }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const QUESTIONS = [
    "مستعدة تسمعي حاجه من قلبي بجد؟",
    "فاكره اول مرة اتكلمنا فيها؟",
    "بصراحه كده وحشتك ولا لا؟",
    "اهم سوال فيهم.. لسه بتستحمليني ولا لا؟",
    "طب بجد مستعده تسمعي مني كلام مش هزار المره دي؟"
  ];

  // Music & Letter State
  const [audioUrl, setAudioUrl] = useState<string | null>(import.meta.env.VITE_DEFAULT_AUDIO_URL || null);
  const [personalLetter, setPersonalLetter] = useState(import.meta.env.VITE_PERSONAL_LETTER || "جنات يمكن انا بعيد عنك و حاسس انك زعلامه ان انا و انت مش بنكلم بعض بس انا عادي والله و كويس انك جنبي دلوقتي بس انا مش عاوزك تفكري افاكر وحشه في دماغك انا عاوزك تفكري ب ايام الي كنا مع بعض فيها ولا تفكري في اي حاجات في دماغك ولا عاوزك خايفه من حاجه يمكن بجد مش بنتكلم مع بعض بس بتوحشيني كل يوم و اكتر من يوم الي قبليه و هموت وعرف ولا واحده عملت معاها كدا انتي واحيده الي حبتها عاوز دي تكون في دماغك علشان ولا واحده خلتني مبسوط والله عاوزك كويسه و تكوني احسن مني و عاوزك تكوني شاطره علشان امتحانات ترم قربت ركزي و عاوزك كويسه و ليكي عندي مفاجه لو جبتي درجه حلوه مهم تعرفي انا بحبك اوييييي و بتوحشيني اويييي");
  const [subMessage, setSubMessage] = useState(import.meta.env.VITE_SUB_MESSAGE || "انا عارف انك بسبب اهلك مش عارفين نكلم بس انا متفهم ده يا حبيبتي والله ومبسوط علشان على الأقل أنتي معايا، بس متخفيش ولا تحسسي نفسك انك خايفه وأنا جنبك والله");
  const [affirmations, setAffirmations] = useState<string[]>(AFFIRMATIONS);

  // 1. Sync App Data from Firestore
  useEffect(() => {
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.audioUrl !== undefined) setAudioUrl(data.audioUrl);
        if (data.personalLetter !== undefined) setPersonalLetter(data.personalLetter);
        if (data.subMessage !== undefined) setSubMessage(data.subMessage);
        if (data.affirmations !== undefined) setAffirmations(data.affirmations);

        // Force upgrade if old message is detected in Firestore
        const oldMsg = "انا عارف انك بسبب اهلك مش عارفين نكلم بس انا متفهم ده يا حبيبتي والله ومبسوط علشان على الأقل أنتي معايا، بس متخفيش ولا تحسسي نفسك انك خايفه وأنا جنبك والله";
        if (data.personalLetter === oldMsg) {
          setDoc(docRef, { personalLetter: personalLetter }, { merge: true })
            .catch(err => console.error("Force update failed:", err instanceof Error ? err.message : String(err)));
        }
      } else {
        // Seed initial data if it doesn't exist
        setDoc(docRef, {
          audioUrl: import.meta.env.VITE_DEFAULT_AUDIO_URL || "",
          personalLetter: import.meta.env.VITE_PERSONAL_LETTER || "جنات يمكن انا بعيد عنك و حاسس انك زعلامه ان انا و انت مش بنكلم بعض بس انا عادي والله و كويس انك جنبي دلوقتي بس انا مش عاوزك تفكري افاكر وحشه في دماغك انا عاوزك تفكري ب ايام الي كنا مع بعض فيها ولا تفكري في اي حاجات في دماغك ولا عاوزك خايفه من حاجه يمكن بجد مش بنتكلم مع بعض بس بتوحشيني كل يوم و اكتر من يوم الي قبليه و هموت وعرف ولا واحده عملت معاها كدا انتي واحيده الي حبتها عاوز دي تكون في دماغك علشان ولا واحده خلتني مبسوط والله عاوزك كويسه و تكوني احسن مني و عاوزك تكوني شاطره علشان امتحانات ترم قربت ركزي و عاوزك كويسه و ليكي عندي مفاجه لو جبتي درجه حلوه مهم تعرفي انا بحبك اوييييي و بتوحشيني اويييي",
          subMessage: import.meta.env.VITE_SUB_MESSAGE || "انا عارف انك بسبب اهلك مش عارفين نكلم بس انا متفهم ده يا حبيبتي والله ومبسوط علشان على الأقل أنتي معايا، بس متخفيش ولا تحسسي نفسك انك خايفه وأنا جنبك والله",
          affirmations: AFFIRMATIONS
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'settings/global'));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    return () => unsubscribe();
  }, []);

  // Update App Data Helpers
  const updateGlobalSetting = async (field: string, value: any) => {
    const docRef = doc(db, 'settings', 'global');
    try {
      await setDoc(docRef, { [field]: value }, { merge: true });
    } catch (err) {
      handleFirestoreError(err instanceof Error ? err.message : String(err), OperationType.UPDATE, 'settings/global');
    }
  };

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setFallingElements(prev => [
        ...prev.slice(-6),
        { 
          id: Date.now() + Math.random(), 
          left: Math.random() * 100, 
          duration: Math.random() * 6 + 6,
          size: Math.random() * 15 + 10,
          type: Math.random() > 0.4 ? 'heart' : 'sparkle'
        }
      ]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (file: File) => {
    if (file) {
      if (!file.type.startsWith('audio/')) {
        alert("يا جنات لازم ترفعي ملف صوتي بس ❤️");
        return;
      }
      
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 100);

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(file);
      
      // Save to IndexedDB
      const request = indexedDB.open('AppAudioDB', 1);
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction(['audio'], 'readwrite');
        const store = transaction.objectStore('audio');
        store.put(file, 'current_track');
        localStorage.removeItem('persistent_audio_url'); 
        
        setTimeout(() => {
          clearInterval(progressInterval);
          setUploadProgress(100);
          setAudioUrl(url);
          setIsPlaying(false);
          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
          }, 500);
        }, 1000);
      };
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
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
        audioRef.current.play().catch(e => console.error("Playback failed:", e instanceof Error ? e.message : String(e)));
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
          onError={() => {
            // Only log or handle if we actually have a url attempting to play
            if (audioUrl && audioUrl.length > 0) {
              setAudioUrl(null);
              // If it was a blob URL, it's definitely stale/broken
              if (audioUrl.startsWith('blob:')) {
                localStorage.removeItem('persistent_audio_url');
              }
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
               <div className="absolute top-0 left-0 w-64 h-64 bg-love-200 rounded-full blur-[60px] -translate-x-1/2 -translate-y-1/2" />
               <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-200 rounded-full blur-[80px] translate-x-1/4 translate-y-1/4" />
            </div>

            <div className="relative z-10 space-y-10 w-full max-w-2xl px-6">
              <AnimatePresence mode="wait">
                {currentQuestion === -1 ? (
                  <motion.div
                    key="initial"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="space-y-10"
                  >
                    <h1 className="text-7xl md:text-9xl text-rose-900 font-bold font-amiri italic tracking-tighter">
                      جاهزة؟
                    </h1>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentQuestion(0)}
                      className="px-16 py-5 bg-love-500 text-white rounded-full text-3xl font-bold shadow-2xl hover:bg-love-600 transition-all border-4 border-white/20 block mx-auto"
                    >
                      ادخلي
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-12"
                  >
                    <div className="space-y-4">
                       <p className="text-love-400 font-bold tracking-widest text-sm uppercase">سؤال رقم {currentQuestion + 1}</p>
                       <h2 className="text-4xl md:text-6xl text-rose-900 font-bold font-amiri leading-tight">
                         {QUESTIONS[currentQuestion]}
                       </h2>
                    </div>

                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="w-full"
                    >
                      <textarea
                        value={userAnswers[currentQuestion]}
                        onChange={(e) => {
                          const newAnswers = [...userAnswers];
                          newAnswers[currentQuestion] = e.target.value;
                          setUserAnswers(newAnswers);
                        }}
                        placeholder="اكتبي ردك هنا يا جنات..."
                        className="w-full p-6 bg-white/50 backdrop-blur-md border-2 border-rose-100 rounded-2xl text-rose-900 font-amiri text-2xl focus:outline-none focus:border-love-300 transition-all min-h-[150px] resize-none shadow-inner"
                      />
                    </motion.div>

                    <div className="flex flex-col md:flex-row gap-4 justify-center items-center w-full">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (currentQuestion < QUESTIONS.length - 1) {
                            setCurrentQuestion(prev => prev + 1);
                          } else {
                            setIsEntered(true);
                            // Save answers to Firestore for persistence across devices
                            try {
                              await addDoc(collection(db, 'interactions'), {
                                answers: userAnswers,
                                timestamp: serverTimestamp()
                              });
                              localStorage.setItem('jannat_answers', JSON.stringify(userAnswers));
                            } catch (err) {
                              handleFirestoreError(err, OperationType.WRITE, 'interactions');
                            }
                          }
                        }}
                        className="px-12 py-4 bg-love-500 text-white rounded-2xl text-xl font-bold shadow-xl hover:bg-love-600 transition-all w-full md:w-64"
                      >
                        {currentQuestion === QUESTIONS.length - 1 ? "خلاص خلصت ❤️" : "التالي ✨"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
          <Stars size={24} />
          <span className="text-xs font-bold font-sans">أمنياتي</span>
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
                          if (newText !== null) updateGlobalSetting('personalLetter', newText);
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
                  <Stars className="text-love-500 w-12 h-12 mb-6 animate-bounce" />
                  <h2 className="text-3xl md:text-5xl text-love-600 mb-4 font-bold font-amiri">أمنياتي ليكي ومعاكي.. ✨</h2>
                  <div className="mt-8 w-full h-1 bg-gradient-to-r from-transparent via-love-200 to-transparent" />
                  <button 
                    onClick={() => setCurrentPage('space')}
                    className="mt-6 text-sm font-bold text-love-400 hover:text-love-600 transition-colors flex items-center gap-2"
                  >
                    شوفي أنا نفسي في إيه.. <Stars size={14} />
                  </button>
                </div>
                <div className="glass rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-love-200/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-love-100/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                  <Heart className="text-love-400 w-10 h-10 mb-6 drop-shadow-sm" />
                  <p className="text-2xl md:text-3xl text-rose-900 font-bold font-amiri leading-loose">
                    {subMessage}
                  </p>
                  <button 
                    onClick={() => {
                      const newText = prompt("اكتب الكلام اللي تحت هنا يا بطل:", subMessage);
                      if (newText !== null) updateGlobalSetting('subMessage', newText);
                    }}
                    className="mt-4 text-xs text-rose-300 hover:text-love-400 font-bold transition-colors"
                  >
                    تعديل النص السفلي 🖋️
                  </button>
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
                <Stars className="w-12 h-12 text-love-500 mx-auto mb-4 animate-pulse" />
                <h2 className="text-4xl md:text-6xl text-love-600 font-bold mb-4 italic">حاجات نفسي أعملها معاكي ❤️</h2>
                <p className="text-lg md:text-2xl text-rose-800/60 font-bold italic">كل ثانية في خيالي بتبدأ بيكي..</p>
              </div>

              <div className="grid grid-cols-1 gap-12">
                {/* Dreams/Wishes Section */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/80 backdrop-blur-xl border-2 border-love-100 p-10 md:p-16 rounded-[4rem] shadow-2xl overflow-hidden relative group"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-love-50 rounded-full blur-[60px] -mr-24 -mt-24 opacity-50 transition-transform group-hover:scale-110" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-50 rounded-full blur-[40px] -ml-16 -mb-16 opacity-40" />
                  
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="mb-8 p-6 bg-love-50 rounded-[2rem] border border-love-100 transform -rotate-2 group-hover:rotate-0 transition-transform duration-500">
                      <Navigation size={40} className="text-love-500" />
                    </div>
                    
                    <p className="text-3xl md:text-5xl font-bold text-rose-900 leading-[1.8] font-amiri italic">
                      "أنـا نفسي أتمشىٰ معـاكي لحد لما أزهـق، ولو حد رن هقفـل السكة في وشه وأكمـل معـاكي.."
                    </p>
                    
                    <div className="mt-12 flex items-center justify-center gap-4">
                      <div className="h-px w-12 bg-love-200" />
                      <Heart size={20} className="text-love-400 fill-current" />
                      <div className="h-px w-12 bg-love-200" />
                    </div>
                    
                    <motion.p 
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      className="mt-6 text-love-400 font-bold text-sm tracking-widest"
                    >
                      دي أول أمنية في القائمة الطويلة اللي مستني أحققها معاكي ❤️
                    </motion.p>
                  </div>
                </motion.div>

                {/* Additional Decorative Dream Card */}
                <motion.div 
                   initial={{ opacity: 0, y: 30 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.2 }}
                   className="glass p-8 rounded-[3rem] text-center border border-white/50"
                >
                  <p className="text-love-600 font-bold italic text-xl">
                    كل اللي بتمناه إنك دايماً تكوني مبسوطة وجنبي..
                  </p>
                </motion.div>
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
