(function() {
  // ========== العناصر ==========
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const fileNameEl = document.getElementById('fileName');
  const textContentEl = document.getElementById('textContent');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const speedRange = document.getElementById('speedRange');
  const speedValue = document.getElementById('speedValue');
  const themeToggle = document.getElementById('themeToggle');

  // ========== متغيرات الحالة ==========
  let speechSynth = window.speechSynthesis;
  let utterance = null;
  let fullText = '';
  let currentCharIndex = 0;
  let isPaused = false;
  let currentRate = 1;
  let darkMode = true;

  // ========== إعداد PDF.js ==========
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  // ========== الوضع الليلي/النهاري ==========
  function setTheme(isDark) {
    if (isDark) {
      document.body.style.background = "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)";
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      document.body.style.background = "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)";
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }

  themeToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    setTheme(darkMode);
  });

  // ========== تنظيف النص: إزالة المسافات الزائدة بين الحروف ==========
  function cleanArabicText(text) {
    // يزيل المسافات بين الحروف العربية
    text = text.replace(/([ء-ي]) ([ء-ي])/g, '$1$2');
    // يزيل المسافات المتكررة
    text = text.replace(/\s+/g, ' ');
    // يرجع النص النظيف
    return text.trim();
  }

  // ========== استخراج النص من PDF ==========
  async function extractPDFText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let extractedText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      extractedText += pageText + '\n';
    }
    return cleanArabicText(extractedText);
  }

  // ========== قراءة ملف TXT ==========
  function readTXTFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(cleanArabicText(e.target.result));
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ========== معالجة الملف المحدد ==========
  async function handleFile(file) {
    if (!file) return;
    fileNameEl.textContent = `📄 ${file.name}`;
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        fullText = await extractPDFText(file);
      } else {
        fullText = await readTXTFile(file);
      }
      
      if (!fullText || fullText.length < 5) {
        textContentEl.textContent = '⚠️ الملف فارغ أو النص قصير جداً.';
        return;
      }
      
      textContentEl.textContent = fullText;
      stopSpeech();
    } catch (error) {
      console.error(error);
      textContentEl.textContent = '❌ حدث خطأ أثناء قراءة الملف. تأكد من صيغته.';
    }
  }

  // ========== أحداث رفع الملف ==========
  uploadArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // ========== التحقق من الصوت العربي ==========
  function getArabicVoice() {
    const voices = speechSynth.getVoices();
    // نبحث عن صوت عربي
    let arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
    return arabicVoice || null;
  }

  // ========== إيقاف كل شيء ==========
  function stopSpeech() {
    speechSynth.cancel();
    isPaused = false;
    currentCharIndex = 0;
    updateProgress(0);
    textContentEl.innerHTML = fullText;
  }

  // ========== تحديث شريط التقدم ==========
  function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
  }

  // ========== بدء القراءة ==========
  function startSpeech(fromIndex = 0) {
    if (!fullText) {
      alert('الرجاء رفع ملف أولاً.');
      return;
    }

    // التحقق من وجود صوت عربي
    const arabicVoice = getArabicVoice();
    if (!arabicVoice) {
      alert('⚠️ لا يوجد صوت عربي مثبت على جهازك.\n\nالحل:\n1. افتح إعدادات Windows\n2. اذهب إلى "الوقت واللغة" > "الكلام"\n3. ثبّت الصوت العربي');
      return;
    }
    
    speechSynth.cancel();
    const textToRead = fullText.substring(fromIndex);
    utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'ar-SA';
    utterance.voice = arabicVoice; // استخدام الصوت العربي
    utterance.rate = currentRate;
    utterance.volume = 1;

    utterance.onboundary = (event) => {
      if (event.charIndex !== undefined) {
        currentCharIndex = fromIndex + event.charIndex;
        const percent = Math.min(100, Math.round((currentCharIndex / fullText.length) * 100));
        updateProgress(percent);
        
        // تظليل الكلمة الحالية
        const before = fullText.substring(0, currentCharIndex);
        const word = fullText.substring(currentCharIndex, currentCharIndex + 10);
        const after = fullText.substring(currentCharIndex + 10);
        textContentEl.innerHTML = `${before}<span class="highlight">${word}</span>${after}`;
      }
    };

    utterance.onend = () => {
      if (currentCharIndex >= fullText.length - 2) {
        updateProgress(100);
        currentCharIndex = 0;
        textContentEl.innerHTML = fullText;
      }
    };

    utterance.onerror = (e) => {
      console.error('خطأ في النطق:', e);
    };

    speechSynth.speak(utterance);
    isPaused = false;
  }

  // ========== تحميل الأصوات ==========
  speechSynth.onvoiceschanged = () => {
    console.log('الأصوات المتاحة:', speechSynth.getVoices().map(v => `${v.name} (${v.lang})`));
  };

  // ========== الأزرار ==========
  playBtn.addEventListener('click', () => {
    stopSpeech();
    startSpeech(0);
  });

  pauseBtn.addEventListener('click', () => {
    if (speechSynth.speaking && !isPaused) {
      speechSynth.pause();
      isPaused = true;
    }
  });

  resumeBtn.addEventListener('click', () => {
    if (isPaused) {
      speechSynth.resume();
      isPaused = false;
    } else if (!speechSynth.speaking && currentCharIndex > 0) {
      startSpeech(currentCharIndex);
    }
  });

  stopBtn.addEventListener('click', stopSpeech);

  // ========== النقر على شريط التقدم ==========
  progressContainer.addEventListener('click', (e) => {
    if (!fullText) return;
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const newIndex = Math.floor(percent * fullText.length);
    stopSpeech();
    startSpeech(newIndex);
  });

  // ========== تغيير السرعة ==========
  speedRange.addEventListener('input', () => {
    currentRate = parseFloat(speedRange.value);
    speedValue.textContent = currentRate.toFixed(1) + 'x';
    
    if (speechSynth.speaking) {
      const currentIdx = currentCharIndex;
      speechSynth.cancel();
      startSpeech(currentIdx);
    }
  });

})();
