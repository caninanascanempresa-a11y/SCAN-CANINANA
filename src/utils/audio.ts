/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Native Web Audio API Beep Synthesizer + Custom MP3 Sounds
export function playBeep(type: 'success' | 'error' | 'warning' = 'success') {
  try {
    // Custom audio elements
    if (type === 'success') {
      const audio = new Audio('/scaneado.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => playNativeBeep('success'));
    } else if (type === 'error' || type === 'warning') {
      const audio = new Audio('/nao_encontrado.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => playNativeBeep('error'));
    }

    // Attempt haptic vibration feedback for mobile devices
    if (navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate(60);
      } else if (type === 'error') {
        navigator.vibrate([100, 50, 100]);
      } else {
        navigator.vibrate(100);
      }
    }
  } catch (err) {
    console.warn('Audio/Vibration feedback blocked or unsupported:', err);
  }
}

// Fallback synthesizer
function playNativeBeep(type: 'success' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch (e) {
    console.warn(e);
  }
}

// Web Speech API Voice Recognition Handler (Portuguese-BR)
export function startVoiceSearch(onResult: (text: string) => void, onError: (err: string) => void, onEnd: () => void) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    onError('Reconhecimento de voz não suportado neste navegador. Use Google Chrome ou Safari.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const resultText = event.results[0][0].transcript;
    onResult(resultText);
  };

  recognition.onerror = (event: any) => {
    onError(`Erro de voz: ${event.error}`);
  };

  recognition.onend = () => {
    onEnd();
  };

  try {
    recognition.start();
    return recognition;
  } catch (err: any) {
    onError(err.message || 'Falha ao iniciar reconhecimento.');
    return null;
  }
}
