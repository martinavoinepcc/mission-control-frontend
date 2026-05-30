'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faRotateRight,
  faUpRightFromSquare,
  faBoxArchive,
  faMicrophone,
  faMicrophoneSlash,
} from '@fortawesome/free-solid-svg-icons';

const COCKPIT_URL =
  process.env.NEXT_PUBLIC_HEIMDALL_COCKPIT_URL ||
  'https://mission-control-heimdall.onrender.com';

const VOICE_WS_URL =
  process.env.NEXT_PUBLIC_VOICE_WS_URL ||
  'wss://mission-control-voice.onrender.com/voice';

export default function HeimdallCockpit() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  return (
    <main
      className="fixed inset-0 flex flex-col bg-cosmos-950 z-0"
      style={{ height: '100dvh' }}
    >
      {/* Top bar avec safe-area iPhone */}
      <header
        className="relative flex items-center gap-2 px-3 pb-2 border-b border-white/10 bg-cosmos-950/85 backdrop-blur-md flex-shrink-0"
        style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => router.push('/dashboard?realm=family')}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Retour dashboard"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 leading-tight">BIFROST</p>
          <p className="font-display font-semibold text-sm text-white truncate leading-tight">HEIMDALL</p>
        </div>
        <button
          onClick={() => router.push('/apps/heimdall/drops/')}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Drops FRIDAY"
          title="Drops FRIDAY (modules entrants)"
        >
          <FontAwesomeIcon icon={faBoxArchive} className="text-sm" />
        </button>
        <button
          onClick={() => {
            if (iframeRef.current) {
              setLoading(true);
              // Force reload meme cross-origin
              iframeRef.current.src = iframeRef.current.src;
            }
          }}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Rafraichir"
          title="Rafraichir HEIMDALL"
        >
          <FontAwesomeIcon icon={faRotateRight} className="text-sm" />
        </button>
        <button
          onClick={() => window.open(COCKPIT_URL, '_blank', 'noopener,noreferrer')}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Ouvrir dans Safari"
          title="Ouvrir HEIMDALL en plein dans Safari"
        >
          <FontAwesomeIcon icon={faUpRightFromSquare} className="text-sm" />
        </button>
      </header>

      {/* Iframe Aion UI = HEIMDALL */}
      <div className="relative flex-1 w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-cosmos-950 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Connexion à HEIMDALL</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={COCKPIT_URL}
          className="absolute inset-0 w-full h-full border-0 bg-cosmos-950"
          title="HEIMDALL — cockpit Aion UI"
          allow="clipboard-read; clipboard-write; fullscreen; microphone"
          onLoad={() => setLoading(false)}
        />
      </div>

      {/* Couche voix FRIDAY — flottante, additive, ne touche pas l'iframe */}
      <FridayVoiceOverlay />
    </main>
  );
}

// =====================================================================
// FRIDAY Voice — overlay flottant branché au Voice Orchestrator (WS).
// Mic via Web Speech API, lecture PCM 16k via Web Audio, barge-in.
// =====================================================================
function FridayVoiceOverlay() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState('hors ligne');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<string | null>(null);
  const recogRef = useRef<any>(null);
  const recognizingRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const playHeadRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const send = (type: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type, sessionId: sessionRef.current, ...payload }));
    }
  };

  const ensureAudio = () => {
    if (!audioRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioRef.current = new Ctx({ sampleRate: 16000 });
    }
    if (audioRef.current!.state === 'suspended') audioRef.current!.resume();
    return audioRef.current!;
  };

  const stopPlayback = () => {
    sourcesRef.current.forEach((s) => {
      try { s.stop(); } catch (e) { /* noop */ }
    });
    sourcesRef.current = [];
    playHeadRef.current = 0;
    setSpeaking(false);
  };

  const playPcm = (b64: string) => {
    const ctx = ensureAudio();
    const bin = atob(b64);
    const len = Math.floor(bin.length / 2);
    const f32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      let val = (bin.charCodeAt(i * 2 + 1) << 8) | bin.charCodeAt(i * 2);
      if (val >= 0x8000) val -= 0x10000;
      f32[i] = val / 32768;
    }
    const buf = ctx.createBuffer(1, len, 16000);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    if (playHeadRef.current < now) playHeadRef.current = now;
    src.start(playHeadRef.current);
    playHeadRef.current += buf.duration;
    sourcesRef.current.push(src);
    setSpeaking(true);
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
      if (sourcesRef.current.length === 0) setSpeaking(false);
    };
  };

  const onServer = (m: any) => {
    switch (m.type) {
      case 'ready': sessionRef.current = m.sessionId; setStatus('prête'); break;
      case 'partial_transcript': setTranscript(m.text); break;
      case 'final_transcript': setTranscript(m.text); setReply(''); break;
      case 'assistant_delta': setReply((r) => r + m.text); break;
      case 'tts_audio_chunk': playPcm(m.audio); break;
      case 'barge_in': stopPlayback(); break;
      case 'text_delivery': setReply(m.text); break;
      case 'background_job_done': setReply(String(m.result || '')); break;
      case 'turn_done': break;
      case 'error': setStatus('erreur: ' + m.error); break;
    }
  };

  const connect = () => {
    const ws = new WebSocket(VOICE_WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus('connectée');
      send('hello', { user: { firstName: 'Martin', isOwner: true }, sampleRate: 16000 });
    };
    ws.onmessage = (e) => onServer(JSON.parse(e.data));
    ws.onclose = () => { setStatus('hors ligne'); };
    ws.onerror = () => setStatus('erreur WS');
  };

  const initRecog = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus('Web Speech non supporté'); return null; }
    const r = new SR();
    r.lang = 'fr-CA';
    r.interimResults = true;
    r.continuous = true;
    r.onstart = () => { recognizingRef.current = true; setListening(true); };
    r.onend = () => {
      recognizingRef.current = false;
      setListening(false);
      if (open) { try { r.start(); } catch (e) { /* noop */ } }
    };
    r.onresult = (ev: any) => {
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t; else interim += t;
      }
      if ((interim || final) && sourcesRef.current.length) { send('barge_in'); stopPlayback(); }
      if (interim) { setTranscript(interim); send('partial_transcript', { text: interim }); }
      if (final) { setTranscript(final); send('final_transcript', { text: final }); }
    };
    return r;
  };

  const startVoice = () => {
    setOpen(true);
    ensureAudio();
    if (!wsRef.current || wsRef.current.readyState > 1) connect();
    if (!recogRef.current) recogRef.current = initRecog();
    if (recogRef.current && !recognizingRef.current) {
      try { recogRef.current.start(); } catch (e) { /* noop */ }
    }
  };

  const stopVoice = () => {
    setOpen(false);
    if (recogRef.current && recognizingRef.current) {
      try { recogRef.current.stop(); } catch (e) { /* noop */ }
    }
    stopPlayback();
  };

  useEffect(() => {
    return () => {
      try { wsRef.current?.close(); } catch (e) { /* noop */ }
      try { recogRef.current?.stop(); } catch (e) { /* noop */ }
    };
  }, []);

  return (
    <>
      {/* Panneau transcript/réponse, visible quand ouvert */}
      {open && (
        <div
          className="absolute left-3 right-3 z-20 rounded-2xl border border-cyan-400/30 bg-cosmos-950/90 backdrop-blur-md p-4 shadow-2xl"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: speaking ? '#7dffb4' : listening ? '#29D0FE' : '#5b7186' }}
            />
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              FRIDAY · {speaking ? 'parle' : listening ? 'écoute' : status}
            </p>
          </div>
          {transcript && <p className="text-white/50 text-xs mb-1">« {transcript} »</p>}
          {reply && <p className="text-white text-sm whitespace-pre-wrap">{reply}</p>}
        </div>
      )}

      {/* Bouton micro flottant */}
      <button
        onClick={() => (open ? stopVoice() : startVoice())}
        aria-label="Parler à FRIDAY"
        className="absolute right-4 z-30 w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          background: open
            ? 'radial-gradient(circle at 50% 40%, rgba(125,255,180,.4), rgba(41,208,254,.15))'
            : 'radial-gradient(circle at 50% 40%, rgba(41,208,254,.45), rgba(41,208,254,.1))',
          boxShadow: open
            ? '0 0 40px rgba(125,255,180,.5)'
            : '0 0 30px rgba(41,208,254,.4)',
          border: '1px solid rgba(41,208,254,.5)',
        }}
      >
        <FontAwesomeIcon
          icon={open ? faMicrophoneSlash : faMicrophone}
          className="text-white text-lg"
        />
      </button>
    </>
  );
}
