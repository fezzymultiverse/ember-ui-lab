// Ember Add-On: native bridge (www/ember_native.js)
// Talks to android_patch/.../EmberMediaPlugin.kt (phone music files) and EmberNotifyPlugin.kt (registered
// manually in MainActivity -- these are local plugins, not npm packages, so `cap sync`
// alone will NOT pull them in; they must be copied into android/app/src/main/java/...).
// Needs @capacitor-community/keep-awake synced for holdDuringReply to do anything.
// No-ops gracefully in a plain browser (no Capacitor) so dev/testing still works.
'use strict';
(() => {
  const cap = window.Capacitor;
  const P = (cap && cap.Plugins) || {};
  // V1.5.6: Capacitor.Plugins.X only exists for plugins whose JS side registered itself, and this app has no bundler to do that.
  // Inside the APK every native plugin is still reachable, so ask Capacitor for it by name. In a plain browser this stays undefined
  // (so everything keeps no-oping gracefully there).
  function plug(name) {
    if (!cap) return undefined;
    if (P[name]) return P[name];
    try { if (cap.isNativePlatform && cap.isNativePlatform() && cap.isPluginAvailable && cap.isPluginAvailable(name) && cap.registerPlugin) return cap.registerPlugin(name); } catch (e) { /* not available */ }
    return undefined;
  }
  const Media = plug('EmberMedia');   // local plugin
  const Notify = plug('EmberNotify'); // local plugin
  const AiP = plug('EmberAi');        // local plugin (V1.5.9: background replies)
  const WebP = plug('EmberWeb');      // local plugin (V1.8.3: real in-app browser)
  const Dev = plug('EmberDevice');   // local plugin (V1.6.6: Device panel)
  const WL = plug('KeepAwake');       // @capacitor-community/keep-awake

  // V1.5.7: phone music access for Ember's own player (ember_player.js). Lists the audio files Android has indexed and reads one
  // in small chunks so the WebView can play it (a content:// file cannot be handed to the WebView directly). Needs the updated EmberMediaPlugin.
  const device = Media ? {
    async has() { const r = await Media.hasPermission(); return !!(r && r.granted); },
    async request() { const r = await Media.requestMusicPermission(); return !!(r && r.granted); },
    async list() { const r = await Media.getLibrary(); return (r && r.tracks) || []; },
    async read(id, size, mime) {
      if (size && size > 250 * 1024 * 1024) throw new Error('That file is over 250 MB.');
      const parts = []; let off = 0;
      for (;;) {
        const r = await Media.readChunk({ id: String(id), offset: off, length: 786432 });
        const bin = atob((r && r.data) || ''), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        if (u8.length) parts.push(u8);
        off += u8.length;
        if (!u8.length || (r && r.eof)) break;
      }
      return new Blob(parts, { type: mime || 'audio/mpeg' });
    }
  } : null;

  // ---------- keep-awake: hold while a reply is streaming in, or persistently when the user turns it on ----------
  let wakeHeld = false; // true while the persistent toggle is ON (not just a per-reply hold)
  async function holdDuringReply(promise) {
    // When the persistent toggle is already on, the lock is already held -- don't release it after.
    if (wakeHeld) { try { return await promise; } finally { /* leave it held */ } }
    try { if (WL) await WL.keepAwake(); } catch (e) { /* no-op outside Capacitor, or isSupported() is false */ }
    try { return await promise; }
    finally { try { if (WL) await WL.allowSleep(); } catch (e) {} }
  }
  async function wakeLockAvailable() {
    if (!WL) return false;
    try { if (WL.isSupported) { const r = await WL.isSupported(); return r == null ? true : !!(r.isSupported != null ? r.isSupported : r); } return true; }
    catch (e) { return false; }
  }
  async function setWakeLock(on) {
    if (!WL) return { ok: false, note: 'KeepAwake plugin not loaded (needs `cap sync android` with @capacitor-community/keep-awake).' };
    try { if (on) await WL.keepAwake(); else await WL.allowSleep(); wakeHeld = !!on; return { ok: true }; }
    catch (e) { return { ok: false, note: e.message || 'Could not change the wake lock.' }; }
  }
  function wakeLockHeld() { return wakeHeld; }
  // Battery-optimization exemption and raw storage access need a tiny native call this build doesn't ship yet
  // (see android_patch/ -- EmberNotifyPlugin.kt gets a requestBatteryExemption/hasBatteryExemption pair).
  // Calling it here is future-proof: once that native method exists this "just works", and until then it reports clearly.
  async function requestBatteryExemption() {
    if (!Notify || typeof Notify.requestBatteryExemption != 'function') return { ok: false, note: 'Needs the updated android_patch (requestBatteryExemption) built in -- see docs/ANDROID_PERMISSIONS.md.' };
    try { const r = await Notify.requestBatteryExemption(); return { ok: !!(r && r.granted), note: r && r.note }; }
    catch (e) { return { ok: false, note: e.message || 'Could not open the battery settings.' }; }
  }
  async function batteryExemptionStatus() {
    if (!Notify || typeof Notify.hasBatteryExemption != 'function') return { granted: false, note: 'unknown (native call not built yet)' };
    try { return await Notify.hasBatteryExemption(); } catch (e) { return { granted: false, note: e.message }; }
  }
  // ---------- background keep-alive: a real foreground service + CPU wake lock (stops Android killing/restarting the app) ----------
  async function keepAliveStart() {
    if (!Notify || typeof Notify.startKeepAlive != 'function') return { ok: false, note: 'Needs the updated android_patch (keep-alive service) built into this APK -- see docs/ANDROID_PERMISSIONS.md.' };
    try { const r = await Notify.startKeepAlive(); return { ok: !!(r && r.running), note: r && r.note }; }
    catch (e) { return { ok: false, note: e.message || 'Could not start the keep-alive service.' }; }
  }
  async function keepAliveStop() {
    if (!Notify || typeof Notify.stopKeepAlive != 'function') return { ok: true };
    try { await Notify.stopKeepAlive(); return { ok: true }; } catch (e) { return { ok: false, note: e.message }; }
  }
  async function keepAliveStatus() {
    if (!Notify || typeof Notify.isKeepAliveRunning != 'function') return { running: false, native: false, note: 'native service not built into this APK' };
    try { const r = await Notify.isKeepAliveRunning(); return { running: !!(r && r.running), native: true }; } catch (e) { return { running: false, native: true, note: e.message }; }
  }
  async function openAppSettings() {
    if (!Notify || typeof Notify.openAppSettings != 'function') return { ok: false, note: 'Needs the updated android_patch (openAppSettings) built in.' };
    try { await Notify.openAppSettings(); return { ok: true }; } catch (e) { return { ok: false, note: e.message || 'Could not open the app settings.' }; }
  }
  async function fileAccessStatus() {
    // Proxy: the only storage-ish permission this build actually tracks today is EmberMedia's (music library) grant.
    if (!Media) return { granted: false, note: 'EmberMediaPlugin not registered in MainActivity.' };
    try { return await Media.hasPermission(); } catch (e) { return { granted: false, note: e.message }; }
  }
  async function requestFileAccess() {
    if (!Media) return { granted: false, note: 'EmberMediaPlugin not registered in MainActivity.' };
    try { return await Media.requestMusicPermission(); } catch (e) { return { granted: false, note: e.message }; }
  }

  // ---------- real notification + real reply box ----------
  async function ensureNotifyPermission() {
    if (!Notify) return false;
    try {
      const p = await Notify.hasPermission();
      if (p.granted) return true;
      const r = await Notify.requestNotifyPermission();
      return !!r.granted;
    } catch (e) { return false; }
  }

  // V1.6.3: asks Android whether notifications are allowed WITHOUT showing a prompt (used by the Settings status line).
  async function notifyPermissionStatus() {
    if (!Notify) return { granted: false, native: false };
    try { const p = await Notify.hasPermission(); return { granted: !!(p && p.granted), native: true }; }
    catch (e) { return { granted: false, native: true, note: e.message }; }
  }

  async function notifyReply(previewText) {
    if (!document.hidden) return; // app is foreground, chat already shows it
    const ok = await ensureNotifyPermission();
    if (!ok || !Notify) return;
    try {
      await Notify.notify({ title: 'Ember', body: String(previewText || '').slice(0, 120) || 'New reply.' });
    } catch (e) { /* notification failed, chat still has the reply */ }
  }

  // V1.6.1: fires a real notification right now, regardless of whether the app is foreground — for testing that
  // notifications actually work on this phone, separate from the proactive-pings flow which needs a Groq key.
  async function testNotify() {
    const ok = await ensureNotifyPermission();
    if (!ok || !Notify) return { ok: false, note: 'No permission, or no native bridge.' };
    try { await Notify.notify({ title: 'Ember', body: 'Notifications are working.' }); return { ok: true }; }
    catch (e) { return { ok: false, note: e.message || 'Could not send it.' }; }
  }

  // ---------- native speech recognition (Android WebView has NO webkitSpeechRecognition) ----------
  const SRP = plug('SpeechRecognition'); // @capacitor-community/speech-recognition
  const speech = SRP ? (() => {
    let guard = null;
    const clearGuard = () => { if (guard) { clearTimeout(guard); guard = null; } };
    return {
      isNative: true,
      async available() { try { const r = await SRP.available(); return !!(r && r.available); } catch (e) { return false; } },
      async ensurePermission() {
        try {
          let p = await SRP.checkPermissions();
          if (p && p.speechRecognition === 'granted') return true;
          p = await SRP.requestPermissions();
          return !!(p && p.speechRecognition === 'granted');
        } catch (e) { return false; }
      },
      // Popup route: Android's own "Speak now" dialog (RecognizerIntent). Used when the silent recogniser cannot start,
      // e.g. on phones where the quiet recogniser service is missing but the dialog still works.
      async startPopup(opts) {
        try {
          const r = await SRP.start({ language: opts.lang || 'en-US', maxResults: 1, prompt: 'Say anything', partialResults: false, popup: true });
          const m = (r && (r.matches || r.value)) || []; const t = String(m[0] || '');
          if (t) { opts.onText(t); return true; }
          return false;
        } catch (e) { return false; }
      },
      // opts: { lang, onText(text), onState(bool), onError(msg) }
      async start(opts) {
        try { await SRP.removeAllListeners(); } catch (e) {}
        const pick = d => { const m = (d && (d.matches || d.value)) || []; return String(m[0] || ''); };
        await SRP.addListener('partialResults', d => { const t = pick(d); if (t) opts.onText(t); });
        await SRP.addListener('listeningState', d => {
          const on = !!(d && d.status === 'started');
          opts.onState(on);
          if (!on) { clearGuard(); try { SRP.removeAllListeners(); } catch (e) {} }
        });
        try {
          const r = await SRP.start({ language: opts.lang || 'en-US', maxResults: 1, partialResults: true, popup: false });
          const t = pick(r); if (t) opts.onText(t);
          guard = setTimeout(() => { try { SRP.stop(); } catch (e) {} }, 60000);
        } catch (e) {
          clearGuard(); opts.onState(false);
          // the silent recogniser failed to start: try the system dialog once before giving up
          const was = String((e && (e.message || e.errorMessage)) || 'Could not start the microphone');
          opts.onState(true);
          const ok = await this.startPopup(opts);
          opts.onState(false);
          if (!ok) opts.onError(was);
        }
      },
      async stop() { clearGuard(); try { await SRP.stop(); } catch (e) {} }
    };
  })() : null;

  // ---------- mic permission ----------
  async function ensureMicPermission() {
    if (speech) return speech.ensurePermission();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) { return false; }
  }

  async function musicPermissionStatus() {
    if (!Media) return { granted: false, note: 'EmberMediaPlugin not registered in MainActivity.' };
    try { return await Media.hasPermission(); } catch (e) { return { granted: false, note: e.message }; }
  }

  // ---------- native text-to-speech (Android WebView often has NO speechSynthesis voices) ----------
  const TTSP = plug('TextToSpeech'); // @capacitor-community/text-to-speech
  let voiceCache = null;
  const tts = TTSP ? {
    isNative: true,
    // V1.8.1: the voices the phone's speech engine actually has (the plugin returns them in an order its speak() indexes into)
    // V1.9.23: an empty answer is NOT cached (the engine is often still starting on the first call), the call is retried, and duplicate names get a unique id
    async voices(force) {
      if (voiceCache && voiceCache.length && !force) return voiceCache;
      // V1.9.24: a partial answer is NOT trusted either. Ask until two calls in a row return the same count (max 8 tries), keep the biggest list seen.
      let list = [], prev = -1;
      for (let k = 0; k < 8; k++) {
        let cur = [];
        try { const r = await TTSP.getSupportedVoices(); cur = (r && r.voices) || []; } catch (e) { cur = []; }
        if (cur.length > list.length) list = cur;
        if (cur.length && cur.length === prev) break;
        prev = cur.length;
        await new Promise(res => setTimeout(res, 700));
      }
      const seen = {};
      voiceCache = list.map((v, i) => {
        const base = String(v.voiceURI || v.name || i); seen[base] = (seen[base] || 0) + 1;
        return { i, uri: seen[base] > 1 ? base + '#' + i : base, name: String(v.name || v.voiceURI || ('Voice ' + i)), lang: String(v.lang || ''), local: v.localService !== false };
      });
      return voiceCache;
    },
    // o = { voice: voiceURI, rate, pitch }; unknown or missing values fall back to the engine default
    async speak(text, lang, o) {
      o = o || {};
      const rate = Math.min(2, Math.max(0.5, Number(o.rate) || 1)), pitch = Math.min(2, Math.max(0.5, Number(o.pitch) || 1));
      let vi = -1;
      let vlang = '';
      if (o.voice) { const vs = await this.voices(); const f = vs.find(v => v.uri === o.voice); if (f) { vi = f.i; vlang = f.lang; } }
      if (vlang) lang = vlang; // a chosen voice speaks in its own language
      const tryLang = async l => { const a = { text, lang: l, rate, pitch, volume: 1.0, category: 'playback', queueStrategy: 0 }; if (vi >= 0) a.voice = vi; await TTSP.speak(a); };
      try { await tryLang(lang || 'en-US'); return { ok: true }; }
      catch (e) {
        // an engine that lacks e.g. en-ZA still speaks en-US
        if (lang && lang != 'en-US') { try { await tryLang('en-US'); return { ok: true }; } catch (e2) { e = e2; } }
        return { ok: false, note: String((e && (e.message || e.errorMessage)) || 'Text-to-speech failed. Check that a speech engine (Google Speech Services) is installed.').slice(0, 140) };
      }
    },
    async stop() { try { await TTSP.stop(); } catch (e) { /* nothing speaking */ } }
  } : null;

  // ---------- V1.5.8: native music notification + proactive AI pings ----------
  // Every call is a quiet no-op in a plain browser or on an APK built before V1.5.8 (the native method is missing).
  const hasM = (o, n) => !!o && typeof o[n] == 'function';
  async function mediaNotify(title, artist, isPlaying) {
    if (!hasM(Media, 'updateNotification')) return { ok: false, note: 'Needs the V1.5.8 APK (updateNotification).' };
    try { await Media.updateNotification({ title: String(title || 'Unknown track'), artist: String(artist || ''), isPlaying: !!isPlaying }); return { ok: true }; }
    catch (e) { return { ok: false, note: (e && e.message) || 'Could not update the music notification.' }; }
  }
  async function mediaClear() {
    if (!hasM(Media, 'clearNotification')) return { ok: true };
    try { await Media.clearNotification(); return { ok: true }; } catch (e) { return { ok: false, note: e && e.message }; }
  }
  async function syncNativeConfig(cfg) {
    if (!hasM(Notify, 'saveNativeConfig')) return { ok: false, note: 'Needs the V1.5.8 APK (saveNativeConfig).' };
    try { await Notify.saveNativeConfig({ plan:cfg.plan || [],groqKey: cfg.groqKey || '', summary: cfg.summary || '', model: cfg.model || '', lastActive: cfg.lastActive || Date.now() }); return { ok: true }; }
    catch (e) { return { ok: false, note: (e && e.message) || 'Could not save the ping settings.' }; }
  }
  async function setProactivePings(enabled, hours) {
    if (!hasM(Notify, 'setProactivePings')) return { ok: false, note: 'Needs the V1.5.8 APK (setProactivePings).' };
    try { await Notify.setProactivePings({ enabled: !!enabled, hours: hours || 4 }); return { ok: true }; }
    catch (e) { return { ok: false, note: (e && e.message) || 'Could not change the ping schedule.' }; }
  }
  async function pingNow() {
    if (!hasM(Notify, 'pingNow')) return { ok: false, note: 'Needs the V1.5.8 APK (pingNow).' };
    try { await Notify.pingNow(); return { ok: true }; } catch (e) { return { ok: false, note: (e && e.message) || 'Could not start a test ping.' }; }
  }

  // ---------- V1.5.9: background chat replies ----------
  const aiAvailable = !!AiP && typeof AiP.askInBackground == 'function';
  async function aiAsk(req) {
    if (!aiAvailable) return { ok: false, note: 'Needs the V1.5.9 APK (EmberAi).' };
    try { await AiP.askInBackground(req); return { ok: true }; } catch (e) { return { ok: false, note: (e && e.message) || 'Could not start the background reply.' }; }
  }
  async function aiCancel(turnId) { if (!aiAvailable) return; try { await AiP.cancel({ turnId }); } catch (e) { /* nothing queued */ } }
  async function aiSetVisible(v) { if (!aiAvailable) return; try { await AiP.setVisible({ visible: !!v }); } catch (e) { /* older APK */ } }
  async function aiTakeResults() {
    if (!aiAvailable) return [];
    try { const r = await AiP.takeResults(); if(r && Array.isArray(r.routing) && window.Prov) for(const a of r.routing){ if(!Prov.CFG[a.id])continue;Prov.record(a.id,a.model,Number(a.status)===200,a.ms,a.status);const entry=(Prov.entries(a.id)||[]).find(e=>Prov.mask(e.key)===a.key);if(entry&&a.status===429)Prov.modelRest(a.id,entry.key,a.model,Math.max(1,(a.at+(a.retry||60)*1000-Date.now())/1000)); } return (r && Array.isArray(r.results)) ? r.results : []; } catch (e) { return []; }
  }

  // V1.6.6: read-only phone facts for the Device panel (Wi-Fi, VPN, RAM, storage, uptime, battery). Null in a plain browser.
  const sys = Dev ? {
    async info() { try { return await Dev.getInfo(); } catch (e) { return { error: (e && e.message) || 'The Device plugin did not answer. Update the APK.' }; } },
    async requestWifiName() { try { const r = await Dev.requestWifiName(); return !!(r && r.granted); } catch (e) { return false; } }
  } : null;

  const openTermux = Dev ? async () => { try { return await Dev.openApp({ package: 'com.termux' }); } catch (e) { return { ok: false, error: (e && e.message) || 'update the APK' }; } } : null;

  // V1.8.3: real browser. open(url) shows a full-screen WebView; its Ask / Save buttons come back as onPage(cb) with {kind, url, title, text}.
  const web = (WebP && typeof WebP.open == 'function') ? {
    available: true,
    async open(url) { try { const r = await WebP.open({ url: String(url || '') }); return { ok: !!(r && r.ok) }; } catch (e) { return { ok: false, error: (e && e.message) || 'update the APK' }; } },
    async close() { try { await WebP.close(); } catch (e) { /* not open */ } },
    onPage(cb) { try { return WebP.addListener('page', cb); } catch (e) { return null; } },
    onClosed(cb) { try { return WebP.addListener('closed', cb); } catch (e) { return null; } }
  } : { available: false };

  window.EmberNative = {
    web, sys, openTermux,
    device, tts, keepAliveStart, keepAliveStop, keepAliveStatus, openAppSettings,
    speech, holdDuringReply, ensureNotifyPermission, notifyPermissionStatus, notifyReply, testNotify, ensureMicPermission, musicPermissionStatus,
    wakeLockAvailable, setWakeLock, wakeLockHeld, requestBatteryExemption, batteryExemptionStatus, fileAccessStatus, requestFileAccess,
    mediaNotify, mediaClear, syncNativeConfig, setProactivePings, pingNow,
    aiAvailable, aiAsk, aiCancel, aiSetVisible, aiTakeResults
  };
})();
