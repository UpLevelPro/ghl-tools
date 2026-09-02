/**
 * Murphy OS / GHL — Rep Call Diagnostic
 * ------------------------------------------------------------------
 * Paste this whole file into the rep's Chrome DevTools Console while
 * they are on a GHL contact page, THEN reproduce the problem.
 *
 * Chrome blocks console paste by default. If nothing happens, type
 *     allow pasting
 * into the console, press Enter, then paste again.
 *
 * While it runs it prints one line per state change so you can watch
 * live. When the problem has been reproduced, run:
 *
 *     murphyReport()
 *
 * ...which prints a full report AND copies it to the clipboard so the
 * rep can paste it straight into Slack/email.
 *
 * It is READ-ONLY: it observes and logs. It never clicks anything and
 * never changes GHL state. The one exception is that it reads (does not
 * write) localStorage.
 */
(function () {
  'use strict';

  if (window.__murphyDiagLoaded) {
    console.log('%c[MurphyDiag] already running — run murphyReport() when done',
      'color:#b45309;font-weight:bold');
    return;
  }
  window.__murphyDiagLoaded = true;

  var VERSION = 'diag-1.0';
  var T0 = Date.now();
  var rel = function () { return ((Date.now() - T0) / 1000).toFixed(2) + 's'; };

  var D = {
    version: VERSION,
    startedISO: new Date().toISOString(),
    env: {},
    events: [],      // every state change
    calls: [],       // one entry per call
    gum: [],         // getUserMedia attempts
    rtc: [],         // WebRTC connection states
    blocked: [],     // pointer events swallowed by the injected script
    synthClicks: []  // synthetic clicks (the auto-expand)
  };
  window.__murphyDiag = D;

  function log(msg, color) {
    console.log('%c[MurphyDiag ' + rel() + '] ' + msg,
      'color:' + (color || '#2563eb') + ';font-weight:bold');
  }
  function push(kind, detail) {
    D.events.push({ at: rel(), kind: kind, detail: detail });
  }
  function describe(el) {
    if (!el || !el.tagName) return String(el);
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).slice(0, 4).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') +
      (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : '');
  }

  // ---------------------------------------------------------------
  // Environment — the Issue 1 checks
  // ---------------------------------------------------------------
  (function collectEnv() {
    D.env.origin = location.origin;
    D.env.url = location.pathname;
    D.env.secureContext = window.isSecureContext;
    D.env.userAgent = navigator.userAgent;
    D.env.keypadScriptLoaded = !!window.__ghlAutoOpenKeypadLoaded;
    try {
      D.env.requireDispositionFlag = localStorage.getItem('ghl-require-disposition');
    } catch (e) { D.env.requireDispositionFlag = 'unreadable'; }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then(function (s) {
        D.env.micPermission = s.state;
        log('microphone permission: ' + s.state,
          s.state === 'granted' ? '#15803d' : '#dc2626');
        s.onchange = function () {
          D.env.micPermission = s.state;
          push('mic-permission-change', s.state);
          log('microphone permission CHANGED: ' + s.state, '#b45309');
        };
      }).catch(function (e) { D.env.micPermission = 'query-failed: ' + e.message; });
    }

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(function (devs) {
        var byKind = {};
        devs.forEach(function (d) { byKind[d.kind] = (byKind[d.kind] || 0) + 1; });
        D.env.devices = byKind;
        D.env.deviceLabelsExposed = devs.some(function (d) { return !!d.label; });
        var mics = byKind.audioinput || 0;
        log('audio input devices: ' + mics, mics > 0 ? '#15803d' : '#dc2626');
        if (!mics) log('NO MICROPHONE VISIBLE — this alone will break Answer', '#dc2626');
      }).catch(function (e) { D.env.devices = 'error: ' + e.message; });
    }
  })();

  // ---------------------------------------------------------------
  // getUserMedia — does GHL ask for the mic, and does it succeed?
  // ---------------------------------------------------------------
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    var origGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (c) {
      var rec = { at: rel(), constraints: JSON.stringify(c || {}).slice(0, 150), status: 'pending' };
      D.gum.push(rec);
      log('getUserMedia requested', '#7c3aed');
      return origGum(c).then(function (stream) {
        rec.status = 'OK';
        rec.tracks = stream.getTracks().map(function (t) { return t.kind + ':' + t.readyState; });
        log('getUserMedia OK (' + rec.tracks.join(', ') + ')', '#15803d');
        return stream;
      }).catch(function (err) {
        rec.status = 'FAIL';
        rec.error = err.name + ': ' + err.message;
        log('getUserMedia FAILED — ' + rec.error + '  <-- THIS BREAKS ANSWER', '#dc2626');
        throw err;
      });
    };
  }

  // ---------------------------------------------------------------
  // WebRTC — did the call actually connect?
  // ---------------------------------------------------------------
  if (window.RTCPeerConnection) {
    var OrigPC = window.RTCPeerConnection;
    var PatchedPC = function () {
      var pc = new (Function.prototype.bind.apply(OrigPC, [null].concat([].slice.call(arguments))))();
      var entry = { at: rel(), states: [] };
      D.rtc.push(entry);
      ['connectionstatechange', 'iceconnectionstatechange'].forEach(function (ev) {
        pc.addEventListener(ev, function () {
          var s = rel() + ' ' + ev + '=' + pc.connectionState + '/' + pc.iceConnectionState;
          entry.states.push(s);
          if (pc.connectionState === 'connected') log('WebRTC CONNECTED', '#15803d');
          if (pc.connectionState === 'failed') log('WebRTC FAILED', '#dc2626');
        });
      });
      return pc;
    };
    PatchedPC.prototype = OrigPC.prototype;
    window.RTCPeerConnection = PatchedPC;
  }

  // ---------------------------------------------------------------
  // Who swallows pointer events (the injected click-outside blocker)
  // ---------------------------------------------------------------
  var origSIP = Event.prototype.stopImmediatePropagation;
  Event.prototype.stopImmediatePropagation = function () {
    try {
      if (/^(pointerdown|mousedown|click|focusin)$/.test(this.type)) {
        var stack = (new Error().stack || '').split('\n').slice(1, 4)
          .map(function (s) { return s.trim(); }).join(' <= ');
        D.blocked.push({ at: rel(), type: this.type, target: describe(this.target), stack: stack });
        if (D.blocked.length <= 5) log('pointer event SWALLOWED: ' + this.type + ' on ' + describe(this.target), '#b45309');
      }
    } catch (e) {}
    return origSIP.apply(this, arguments);
  };

  // ---------------------------------------------------------------
  // Synthetic clicks (the auto-expand firing)
  // ---------------------------------------------------------------
  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    try {
      if (ev && ev.type === 'click' && ev.isTrusted === false) {
        D.synthClicks.push({ at: rel(), target: describe(this) });
      }
    } catch (e) {}
    return origDispatch.apply(this, arguments);
  };

  // ---------------------------------------------------------------
  // Call + dialer state machine
  // ---------------------------------------------------------------
  function dialerVisible() {
    var d = document.querySelector('.dialer');
    return d ? !!(d.offsetParent || d.getClientRects().length) : false;
  }
  function snapshot() {
    var ec = document.querySelector('.end-call-container');
    return {
      callBox: !!document.querySelector('.call-box'),
      incoming: !!document.querySelector('.incoming-call-bt-ctrl'),
      liveCall: !!document.querySelector('.dialer .hr-button--error-type'),
      dispoPanel: !!ec,
      dialerVisible: dialerVisible(),
      pills: ec ? ec.querySelectorAll('div.cursor-pointer.rounded-md.border').length : 0,
      doneDisabled: ec && ec.querySelector('button.end-call-btn')
        ? !!ec.querySelector('button.end-call-btn').disabled : null
    };
  }

  var lastKey = '';
  var callOpen = false;
  var current = null;

  function tick() {
    var s = snapshot();
    var key = JSON.stringify(s);
    if (key !== lastKey) {
      lastKey = key;
      push('state', s);

      // start of a call
      if ((s.callBox || s.incoming || s.liveCall) && !callOpen) {
        callOpen = true;
        current = {
          call: D.calls.length + 1,
          startedAt: rel(),
          direction: s.incoming ? 'inbound' : 'outbound',
          autoExpandFired: false,
          callBoxSeenFor: 0,
          dispoPanelAppeared: false,
          dispoPanelVisibleWhenOpened: null,
          doneEverDisabled: false,
          maxPills: 0
        };
        D.calls.push(current);
        log('CALL ' + current.call + ' started (' + current.direction + ')', '#2563eb');
      }

      if (current) {
        if (s.dispoPanel && !current.dispoPanelAppeared) {
          current.dispoPanelAppeared = true;
          current.dispoPanelVisibleWhenOpened = s.dialerVisible;
          log('disposition panel opened — dialer visible: ' + s.dialerVisible,
            s.dialerVisible ? '#15803d' : '#dc2626');
          if (!s.dialerVisible) {
            log('PANEL IS RENDERED BUT HIDDEN (collapsed dialer) <-- LIKELY THE BUG', '#dc2626');
          }
        }
        if (s.doneDisabled) current.doneEverDisabled = true;
        if (s.pills > current.maxPills) current.maxPills = s.pills;
      }

      // end of a call
      if (!s.callBox && !s.incoming && !s.liveCall && !s.dispoPanel && callOpen) {
        callOpen = false;
        if (current) { current.endedAt = rel(); log('CALL ' + current.call + ' finished', '#2563eb'); }
        current = null;
      }
    }
    // track how long the collapsed bar lingers (auto-expand not firing)
    if (current && s.callBox) current.callBoxSeenFor += 0.05;
    if (current && D.synthClicks.length && !current.autoExpandFired) {
      current.autoExpandFired = true;
      log('auto-expand fired for call ' + current.call, '#15803d');
    }
  }

  setInterval(tick, 50);
  new MutationObserver(tick).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled']
  });
  tick();

  // ---------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------
  window.murphyReport = function () {
    var L = [];
    L.push('===== MURPHY OS CALL DIAGNOSTIC (' + VERSION + ') =====');
    L.push('captured: ' + D.startedISO + '  duration: ' + rel());
    L.push('');
    L.push('--- ENVIRONMENT ---');
    L.push('origin:               ' + D.env.origin);
    L.push('mic permission:       ' + D.env.micPermission + (D.env.micPermission === 'granted' ? '' : '   <-- SUSPECT'));
    L.push('audio input devices:  ' + JSON.stringify(D.env.devices));
    L.push('keypad script loaded: ' + D.env.keypadScriptLoaded);
    L.push('require-dispo flag:   ' + D.env.requireDispositionFlag +
      (D.env.requireDispositionFlag === 'true' ? '   <-- ENFORCEMENT IS ON FOR THIS REP' : ''));
    L.push('secure context:       ' + D.env.secureContext);
    L.push('');
    L.push('--- CALLS (' + D.calls.length + ') ---');
    if (!D.calls.length) L.push('(no calls captured — was the tab in the foreground?)');
    D.calls.forEach(function (c) {
      L.push('Call ' + c.call + ' [' + c.direction + '] ' + c.startedAt + ' -> ' + (c.endedAt || 'open'));
      L.push('   auto-expand fired:        ' + c.autoExpandFired + (c.autoExpandFired ? '' : '   <-- dialer stayed collapsed'));
      L.push('   collapsed bar visible for: ~' + c.callBoxSeenFor.toFixed(1) + 's');
      L.push('   disposition panel opened: ' + c.dispoPanelAppeared);
      L.push('   ...and dialer visible:    ' + c.dispoPanelVisibleWhenOpened +
        (c.dispoPanelVisibleWhenOpened === false ? '   <-- PANEL HIDDEN, REP CANNOT SEE IT' : ''));
      L.push('   disposition pills:        ' + c.maxPills);
      L.push('   Done ever disabled:       ' + c.doneEverDisabled +
        (c.doneEverDisabled ? '   <-- BLOCKED BY require-disposition' : ''));
    });
    L.push('');
    L.push('--- MICROPHONE / WEBRTC ---');
    if (!D.gum.length) L.push('(no getUserMedia attempts — call never tried to open the mic)');
    D.gum.forEach(function (g) { L.push(g.at + '  getUserMedia ' + g.status + (g.error ? '  ' + g.error : '  ' + (g.tracks || []).join(','))); });
    D.rtc.forEach(function (r, i) { L.push('RTC#' + i + ': ' + (r.states.join(' | ') || 'no state changes')); });
    L.push('');
    L.push('--- SWALLOWED POINTER EVENTS (' + D.blocked.length + ') ---');
    D.blocked.slice(0, 10).forEach(function (b) { L.push(b.at + '  ' + b.type + ' on ' + b.target); });
    if (!D.blocked.length) L.push('(none)');
    L.push('');
    L.push('--- SYNTHETIC CLICKS (' + D.synthClicks.length + ') ---');
    D.synthClicks.slice(0, 10).forEach(function (s) { L.push(s.at + '  ' + s.target); });
    if (!D.synthClicks.length) L.push('(none — auto-expand never fired)');
    L.push('');
    L.push('===== END =====');

    var text = L.join('\n');
    console.log(text);
    try {
      navigator.clipboard.writeText(text).then(function () {
        console.log('%c[MurphyDiag] report copied to clipboard — paste it to Eric',
          'color:#15803d;font-weight:bold');
      });
    } catch (e) {}
    return text;
  };

  log('diagnostic ' + VERSION + ' active. Reproduce the problem, then run: murphyReport()', '#15803d');
  console.log('%cKeep this tab in the FOREGROUND during the call — background tabs are throttled.',
    'color:#b45309;font-weight:bold');
})();
