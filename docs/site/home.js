/*
 * GRAVIEW.DEV'S HOME: THE SCREEN, THE HOLE IN IT, AND THE MAP BEHIND IT.
 *
 * Source, edited by hand, as docs/site/site.css is. One canvas, drawn by
 * three.js r128 (vendor/three-r128.min.js, MIT, its license beside it): an
 * app screen an agent drew, a hole the cursor burns through it, and behind
 * it Graview's map of the records it stands on. Scrolling goes through the
 * screen into the map, a scene at a time.
 *
 * The words are the page's own (index.html): this only moves them. Without
 * WebGL, without three.js, or with the context lost, it hands the page back
 * to its plain layout, where the same words read as a page.
 *
 * The story follows the scroll exactly: a frame's place in it is the page's
 * scroll position, never eased toward it, and the page's own wheel, touch and
 * keys scroll it, untouched. The map can be pressed: a record's block, or a
 * plot's label, opens a card beside it (the card is the page's own, anchored
 * to a corner, never moved with the map), and a list of every record does the
 * same from the keyboard. At the opening, a press through the hole carries the
 * reader into the scene that fits what they pressed: the one place the page
 * moves the reader itself.
 *
 * It draws only when something changes — a scroll, the hole following a
 * pointer, the opening's drift for a while after the page is left alone —
 * and stops when it settles, when the tab is hidden and when the questions
 * under the story cover it.
 *
 * The story is the page's own illustration: an example repository, its
 * sixteen modules, three without a doc, and the three guides a press writes.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("gl")) return;

  var NB = 7;
  var canvas = document.getElementById("gl");
  var track = document.getElementById("track");
  var ui = document.getElementById("ui");
  var head = document.querySelector(".site-head");
  var sheet = document.getElementById("story");
  var dotsEl = document.getElementById("dots");
  var caps = [].slice.call(document.querySelectorAll(".cap"));

  /* What the picture shows at each scene, for the canvas's own label. */
  var SEEN = [
    "An app screen an agent drew, a table of modules. Through a round hole in it, the map of the records it stands on.",
    "The map: a plot for each kind (people, docs, modules, decision records), a block for each record and roads between them. One module, packages/auth, is picked out with its ties.",
    "Three module blocks glow orange, each labeled no doc, beside the rule: every module has a doc.",
    "A presence labeled your agent, reading the map, sends a ring across every block.",
    "Three screens on posts over the map, a periodic table, a status page and a bookshelf, each with beams down to the blocks it shows.",
    "Three new doc blocks rise, the docs plot reads 17, the rule reads rule holds, and the three screens redraw.",
    "The whole map from above.",
  ];
  var NAMES = ["The screen an agent drew"].concat(caps.map(function (c) { return c.getAttribute("data-scene"); }));

  function mq(query) { try { return window.matchMedia ? window.matchMedia(query) : null; } catch (e) { return null; } }
  function on(list, fn) { if (!list) return; if (list.addEventListener) list.addEventListener("change", fn); else if (list.addListener) list.addListener(fn); }
  var mReduce = mq("(prefers-reduced-motion: reduce)"), mTouch = mq("(hover: none)");
  var reduce = !!(mReduce && mReduce.matches);
  /* Forced colors throw the map's palette away: the story reads as the page it is without it. */
  var mForced = mq("(forced-colors: active)");
  if (mForced && mForced.matches) { root.classList.remove("gl"); return; }
  if (mTouch && mTouch.matches) document.getElementById("how-text").textContent = "Touch the app to look behind it. Then scroll to go through it.";

  var clamp = function (x, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x)); };
  var sm = function (x, a, b) { var u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var now = function () { return performance.now(); };

  /* ── the scenes, one press each ─────────────────────────────────────── */
  var dotBtns = [];
  for (var d = 0; d < NB; d++) (function (d) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Scene " + (d + 1) + " of " + NB + ": " + NAMES[d]);
    b.innerHTML = "<i></i>";
    b.addEventListener("click", function () { goBeat(d); });
    dotsEl.appendChild(b);
    dotBtns.push(b);
  })(d);

  /* The headlines arrive a word at a time; a screen reader reads the sentence whole. */
  if (!reduce) caps.forEach(function (cap) {
    var h = cap.querySelector("h2"), said = h.textContent, i = 0;
    var shown = document.createElement("span"); shown.setAttribute("aria-hidden", "true");
    (function walk(from, into) {
      [].slice.call(from.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          n.nodeValue.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { into.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = "w"; w.textContent = tok; w.style.transitionDelay = (i++ * 0.05) + "s"; into.appendChild(w);
          });
        } else if (n.nodeType === 1) { var c = n.cloneNode(false); into.appendChild(c); walk(n, c); }
      });
    })(h, shown);
    var whole = document.createElement("span"); whole.className = "sr-only"; whole.textContent = said;
    h.textContent = ""; h.appendChild(whole); h.appendChild(shown);
  });

  /* ── the story's length, and where the reader is in it ──────────────── */
  var W = 1, H = 1, span = 1, trackH = 1, tTarget = 0, tNow = 0, port = false, short = false, dead = false;
  /* The phone layout is the stylesheet's own breakpoint, asked of the same media query, so the two never disagree. */
  var mPhone = mq("(max-width: 820px)");
  function measure() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight; port = mPhone ? mPhone.matches : W <= 820;
    /* A short desk screen hangs the sheet under the header rather than centering it into the header. */
    short = !port && H < 720; root.classList.toggle("short", short);
    trackH = Math.round(H * (1 + (NB - 1) * 1.2));
    track.style.height = trackH + "px";
    /* The large viewport, which a phone's toolbar coming and going does not change: the story keeps its length under a thumb. */
    span = Math.max(1, trackH - H);
  }
  function read() { tTarget = clamp(window.scrollY / span) * (NB - 1); }
  /* A dot, a record pressed at the opening: the reader asked to be taken there, so they are, smoothly unless they asked for less motion. */
  function goBeat(n) { if (dead) return; window.scrollTo({ top: Math.round(span * n / (NB - 1)), behavior: reduce ? "auto" : "smooth" }); }
  measure(); read(); tNow = tTarget;

  /* ── the words over the canvas: which caption, which dot, which label ── */
  var lastBeat = -9, lastSheet = "", lastInside = null, lastLabel = -1;
  function words(t) {
    var so = (1 - sm(t, .05, .45)).toFixed(3);
    if (so !== lastSheet) {
      lastSheet = so;
      /* Gone from sight is gone from the keyboard too: nothing faded stays pressable under the scenes. The closing scene hands over the same prompt. */
      sheet.style.opacity = so;
      sheet.style.visibility = +so < .01 ? "hidden" : "visible";
      sheet.style.transform = port || short ? "translateY(" + ((1 - so) * -40).toFixed(1) + "px)" : "translateY(calc(-50% + " + ((1 - so) * -40).toFixed(1) + "px))";
    }
    var inside = t > .55;
    if (inside !== lastInside) { lastInside = inside; head.classList.toggle("inside", inside); ui.classList.toggle("inside", inside); }
    var beat = Math.round(t), show = Math.abs(t - beat) < .36 ? beat : -1;
    if (show !== lastBeat) {
      lastBeat = show;
      caps.forEach(function (c) { c.classList.toggle("on", +c.getAttribute("data-beat") === show); });
      for (var z = 0; z < NB; z++) { if (z === beat) dotBtns[z].setAttribute("aria-current", "step"); else dotBtns[z].removeAttribute("aria-current"); }
    }
    if (beat !== lastLabel) { lastLabel = beat; canvas.setAttribute("aria-label", SEEN[beat]); }
  }
  words(tNow);

  /* ── the loop, which runs only while something moves ────────────────── */
  var raf = 0, lastTs = 0, time = 0, ambientUntil = 0, amb = reduce ? 0 : 1, frameFn = null, dirty = true;
  function wake(ms) {
    if (dead) return;
    dirty = true;
    if (!reduce && ms !== 0) ambientUntil = Math.max(ambientUntil, now() + (ms || 6000));
    if (!raf && !document.hidden) { lastTs = 0; raf = requestAnimationFrame(tick); }
  }
  function tick(ts) {
    raf = 0;
    if (dead) return;
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
    lastTs = ts;
    time += dt;
    amb += ((now() < ambientUntil && !reduce ? 1 : 0) - amb) * (1 - Math.exp(-dt * 1.6));
    if (amb < 0.002) amb = 0;
    /* No easing toward the scroll: the frame is where the page is. */
    tNow = tTarget;
    words(tNow);
    var changed = dirty; dirty = false;
    var c0 = performance.now();
    var busy = frameFn ? frameFn(dt, changed) : false;
    /* What a frame cost this page, for the harness that asks (verify-site's frame times). */
    if (window.__homeCosts && frameFn) window.__homeCosts.push(performance.now() - c0);
    if (busy || amb > 0) raf = requestAnimationFrame(tick);
  }

  /* The drift belongs to the opening: in the map, what moves on its own settles a few seconds after the scroll does. */
  var onScroll = null;
  /* Once the questions come up over the map, the map's words and controls leave the page, the keyboard's order too: nothing stays focusable under them. */
  var wasUnder = null;
  function under() { var u = window.scrollY > span + 2; if (u !== wasUnder) { wasUnder = u; root.classList.toggle("under", u); } }
  under();
  window.addEventListener("scroll", function () {
    if (dead) return;
    read();
    if (tTarget > 1) ambientUntil = Math.min(ambientUntil, now() + 4000);
    if (onScroll) onScroll();
    under();
    /* Under the questions the canvas is covered: nothing to draw until it shows again. */
    if (window.scrollY < trackH) wake(4000);
  }, { passive: true });
  on(mReduce, function () { reduce = !!(mReduce && mReduce.matches); if (reduce) { amb = 0; ambientUntil = 0; } wake(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) wake(); });

  /* The keyboard takes the story with it: a control in a scene brings that scene up. */
  ui.addEventListener("focusin", function (e) {
    if (dead) return;
    var cap = e.target.closest && e.target.closest(".cap");
    if (cap) { var n = +cap.getAttribute("data-beat"); if (Math.round(tTarget) !== n) goBeat(n); }
    else if (sheet.contains(e.target)) { if (tTarget > .5) goBeat(0); }
    /* The dots, the card and the list live over the map: under the questions they would be covered, so the keyboard brings the map back. */
    else if (window.scrollY > span + 1) goBeat(NB - 1);
  });

  var started = false;
  /* The plain page: the same words, and nothing of the story's left running on it. */
  function plain(why) {
    if (why && window.console) console.error("graview.dev: the map could not be drawn:", why);
    started = true;
    dead = true;
    frameFn = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    root.classList.remove("gl", "drawn", "short", "under");
    head.classList.remove("inside");
    ui.classList.remove("inside");
    sheet.removeAttribute("style");
    caps.forEach(function (c) { c.classList.remove("on"); });
  }

  /* ── three.js, loaded after the page has drawn ───────────────────────── */
  /* Where three.js is already on the page (the artifact the export makes inlines it), it starts at once. */
  if (window.THREE) setTimeout(function () { try { boot(); } catch (e) { plain(e); } }, 0);
  else {
    var lib = document.createElement("script");
    lib.src = "vendor/three-r128.min.js";
    lib.onload = function () { try { boot(); } catch (e) { plain(e); } };
    lib.onerror = function () { plain("three.js did not load"); };
    setTimeout(function () { if (!started) plain(); }, 20000);
    document.body.appendChild(lib);
  }

  function boot() {
    if (started) return;
    started = true;
    var THREE = window.THREE;
    if (!THREE) { plain(); return; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" }); } catch (e) { plain(); return; }
    if (!renderer.getContext()) { plain(); return; }
    canvas.addEventListener("webglcontextlost", function () { plain(); });
    var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    var deriv = renderer.capabilities.isWebGL2 || renderer.extensions.has("OES_standard_derivatives");
    var aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    /* ── the app behind everything: an example repository ── */
    var MOD = ["packages/search", "packages/auth", "shared-types", "packages/billing", "apps/web", "telemetry", "apps/api", "packages/ui", "packages/email", "packages/queue", "apps/admin", "apps/worker", "infra/deploy", "infra/db", "tools/cli", "tools/lint"];
    var MISSING = { 0: 1, 2: 1, 5: 1 };
    var PPL = ["Priya", "Jonas", "Mei", "Tariq", "Ana", "Lev", "Odile"];
    var OWNER = [0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 4, 5, 6, 0, 1];
    var DOCS = [0, 2, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];   // 14 docs across 13 modules
    var DEC = [2, 3, 1, 2, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0];    // 14 decision records

    var appRows = [];

    /* ── drawing screens on canvases ── */
    function F(g, s) { g.font = s; }
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function drawApp(c, W, H, dpr) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#EEF0F6"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, W, 64); g.fillStyle = "#E1E4EE"; g.fillRect(0, 64, W, 1);
      var x0 = port ? 16 : Math.max(620, W * 0.46), top = port ? 96 : 116, w = W - x0 - (port ? 16 : 56);
      if (!port) { g.fillStyle = "#FFFFFF"; for (var k = 0; k < 3; k++) { rr(g, 44, 104 + k * 210, x0 - 110, 186, 14); g.fill(); } }
      g.fillStyle = "#586174"; F(g, "700 11px Montserrat"); g.fillText("AN EXAMPLE REPOSITORY", x0, top - 16);
      g.fillStyle = "#18213A"; F(g, "700 26px Montserrat"); g.fillText("Modules", x0, top + 22);
      g.fillStyle = "#FDEFD9"; var pill = "3 modules have no doc"; F(g, "700 14px Montserrat"); var pw = g.measureText(pill).width + 28; rr(g, x0 + 128, top, pw, 32, 16); g.fill(); g.fillStyle = "#8A4A10"; g.fillText(pill, x0 + 142, top + 21);
      if (!port) { g.fillStyle = "#001769"; rr(g, x0 + w - 196, top - 4, 196, 40, 9); g.fill(); g.fillStyle = "#fff"; F(g, "700 15px Montserrat"); g.fillText("Write the 3 guides", x0 + w - 172, top + 21); }
      var cy = top + 56, cw = (w - (port ? 12 : 36)) / (port ? 2 : 4), stats = [["Modules", "16"], ["Docs", "14"], ["Decisions", "14"], ["People", "7"]];
      stats.forEach(function (s, i) {
        var cx = x0 + (i % (port ? 2 : 4)) * (cw + 12), yy = cy + (port ? Math.floor(i / 2) * 78 : 0);
        g.fillStyle = "#FFFFFF"; rr(g, cx, yy, cw, port ? 66 : 84, 12); g.fill();
        g.fillStyle = "#586174"; F(g, "600 13px Montserrat"); g.fillText(s[0], cx + 16, yy + 24);
        g.fillStyle = "#001769"; F(g, "700 " + (port ? 24 : 30) + "px Montserrat"); g.fillText(s[1], cx + 16, yy + (port ? 54 : 64));
      });
      var ty = cy + (port ? 170 : 116), rh = port ? 46 : 50, n = Math.max(4, Math.min(8, Math.floor((H - (port ? 0 : 36) - ty - 40) / rh)));
      if (port) n = Math.min(n, Math.max(3, Math.floor((H * 0.46 - ty) / rh)));
      g.fillStyle = "#FFFFFF"; rr(g, x0, ty, w, 40 + n * rh + 8, 14); g.fill();
      var cols = port ? [0, .62] : [0, .42, .6, .82];
      g.fillStyle = "#586174"; F(g, "700 13px Montserrat");
      ["Module", "Docs", "Owner", "Decisions"].forEach(function (t, i) { if (cols[i] !== undefined) g.fillText(t, x0 + 20 + cols[i] * (w - 40), ty + 26); });
      appRows = [];
      for (var r = 0; r < n; r++) {
        var y = ty + 40 + r * rh, miss = !!MISSING[r];
        appRows.push({ x: x0, y: y, w: w, h: rh, mi: r });
        g.fillStyle = "#E8EAF2"; g.fillRect(x0 + 20, y, w - 40, 1);
        g.fillStyle = "#18213A"; F(g, "700 16px Montserrat"); g.fillText(MOD[r], x0 + 20, y + 31);
        g.fillStyle = miss ? "#8A4A10" : "#18213A"; F(g, (miss ? "700" : "500") + " 16px Montserrat"); g.fillText(miss ? "none" : String(DOCS[r]), x0 + 20 + cols[1] * (w - 40), y + 31);
        if (!port) { g.fillStyle = "#18213A"; F(g, "500 16px Montserrat"); g.fillText(PPL[OWNER[r]], x0 + 20 + cols[2] * (w - 40), y + 31); g.fillText(String(DEC[r]), x0 + 20 + cols[3] * (w - 40), y + 31); }
      }
    }
    function small(draw) { var c = document.createElement("canvas"); c.width = 1024; c.height = 640; draw(c.getContext("2d")); var t = new THREE.CanvasTexture(c); t.anisotropy = aniso; return t; }
    var SY = ["Se", "Au", "Ty", "Bi", "We", "Te", "Ap", "Ui"];
    var faces = {
      per: function (fx) {
        return small(function (g) {
          g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 1024, 640); g.fillStyle = "#18213A"; F(g, "900 40px Merriweather"); g.fillText("The modules, as elements", 40, 72);
          for (var i = 0; i < 8; i++) {
            var x = 40 + (i % 4) * 240, y = 110 + Math.floor(i / 4) * 252, miss = MISSING[i] && !fx;
            g.fillStyle = miss ? "#FFE9A8" : "#EEF2FF"; rr(g, x, y, 224, 236, 10); g.fill(); g.lineWidth = 4; g.strokeStyle = "#18213A"; if (miss) g.setLineDash([12, 8]); rr(g, x, y, 224, 236, 10); g.stroke(); g.setLineDash([]);
            g.fillStyle = "#18213A"; F(g, '700 22px "JetBrains Mono"'); g.fillText(String(MISSING[i] ? (fx ? 1 : 0) : DOCS[i]), x + 16, y + 34); F(g, "900 92px Merriweather"); g.fillText(SY[i], x + 14, y + 138); F(g, "700 21px Montserrat"); g.fillText(MOD[i], x + 16, y + 184);
            g.fillStyle = "#586174"; F(g, "500 18px Montserrat"); g.fillText(miss ? "no doc yet" : PPL[OWNER[i]], x + 16, y + 214);
          }
        });
      },
      stat: function (fx) {
        return small(function (g) {
          g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 1024, 640); g.fillStyle = fx ? "#0F7A5C" : "#C2410C"; rr(g, 36, 32, 952, 92, 16); g.fill(); g.fillStyle = "#fff"; F(g, "700 36px Montserrat"); g.fillText(fx ? "All modules documented" : "3 modules undocumented", 64, 92);
          for (var i = 0; i < 8; i++) {
            var y = 150 + i * 60, miss = MISSING[i] && !fx, dd = MISSING[i] ? (fx ? 1 : 0) : DOCS[i];
            g.fillStyle = "#E4E6EE"; g.fillRect(36, y + 52, 952, 2); g.fillStyle = "#18213A"; F(g, "700 26px Montserrat"); g.fillText(MOD[i], 36, y + 36);
            for (var k = 0; k < 4; k++) { g.fillStyle = k < dd ? "#12B886" : "#E4E6EE"; rr(g, 400 + k * 96, y + 10, 84, 32, 6); g.fill(); }
            g.fillStyle = miss ? "#FDE7D8" : "#DDF7EE"; rr(g, 820, y + 8, 168, 36, 18); g.fill(); g.fillStyle = miss ? "#9A3412" : "#0B5F47"; F(g, "700 20px Montserrat"); g.fillText(miss ? "missing" : dd + (dd === 1 ? " doc" : " docs"), 852, y + 33);
          }
        });
      },
      shelf: function (fx) {
        return small(function (g) {
          var gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, "#F3EAD8"); gr.addColorStop(1, "#E6D6B6"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 640); g.fillStyle = "#3B2A14"; F(g, "900 40px Merriweather"); g.fillText("The docs, on a shelf", 40, 70);
          g.fillStyle = "#6B4423"; g.fillRect(0, 566, 1024, 34); var COL = ["#C2410C", "#1D4ED8", "#7C3AED", "#0F766E", "#BE185D", "#B45309", "#4338CA", "#15803D"];
          for (var i = 0; i < 8; i++) {
            var dd = MISSING[i] ? (fx ? 1 : 0) : DOCS[i], x = 52 + i * 118, h = dd ? 230 + dd * 90 : 330, y = 566 - h;
            if (dd) { g.fillStyle = COL[i]; rr(g, x, y, 98, h, 8); g.fill(); g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(x + 80, y, 18, h); } else { g.strokeStyle = "#8A4A10"; g.lineWidth = 4; g.setLineDash([12, 9]); rr(g, x, y, 98, h, 8); g.stroke(); g.setLineDash([]); }
            g.save(); g.translate(x + 58, 566 - 28); g.rotate(-Math.PI / 2); g.fillStyle = dd ? "#fff" : "#8A4A10"; F(g, "700 24px Montserrat"); g.fillText(dd ? MOD[i] : MOD[i] + " · no guide", 0, 0); g.restore();
          }
        });
      },
    };

    /* ── the world: Graview's own map, with real depth ── */
    var dpr = Math.min(window.devicePixelRatio || 1, port ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr); renderer.autoClear = false;
    var BG = 0x0A0F1F, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 26, 78);
    scene.add(new THREE.AmbientLight(0xaab4d8, 0.78)); var sun = new THREE.DirectionalLight(0xffffff, 0.62); sun.position.set(-5, 12, 4); scene.add(sun);
    var GT = (function () { var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.22, "rgba(255,255,255,.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    function glow(col, size, op) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GT, color: col, transparent: true, opacity: op === undefined ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.set(size, size, 1); return s; }

    /* The ground: the map's grid. Where the derivatives a crisp line needs are missing (some WebGL1), a fixed width. */
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, defines: deriv ? { GV_DERIV: 1 } : {}, extensions: { derivatives: deriv },
      uniforms: { c: { value: new THREE.Color(0x9fb0ff) } },
      vertexShader: "varying vec3 w;void main(){vec4 p=modelMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}",
      fragmentShader: "precision highp float;varying vec3 w;uniform vec3 c;" +
        "float ln(float v,float s){float f=abs(fract(v/s-.5)-.5)*s;\n" +
        "#ifdef GV_DERIV\nreturn 1.-smoothstep(0.,fwidth(v)*1.2,f);\n#else\nreturn 1.-smoothstep(0.,.03,f);\n#endif\n}" +
        "void main(){float a=max(ln(w.x,1.),ln(w.z,1.))*.11+max(ln(w.x,5.),ln(w.z,5.))*.07;float d=length(w.xz-cameraPosition.xz);a*=1.-smoothstep(22.,62.,d);gl_FragColor=vec4(c,a);}",
    }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    /* Pills: the map's own labels. */
    var pillH = 0.04, pills = [];
    function pill(big) {
      var c = document.createElement("canvas"); c.width = 640; c.height = 96; var t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, sizeAttenuation: false })); sp.renderOrder = 6; sp.center.set(0, .5);
      var key = ""; sp.userData.big = big;
      sp.reset = function () { key = ""; };
      sp.set = function (name, count, warn, ok) {
        var k = name + "|" + count + "|" + warn + "|" + ok; if (k === key) return; key = k; var g = c.getContext("2d"); g.clearRect(0, 0, 640, 96);
        var fn = (big ? "600 34px" : "600 30px") + " Montserrat", sp2 = big ? 5 : 1.5, x = 24;
        F(g, fn); var wn = 0; for (var i = 0; i < name.length; i++) wn += g.measureText(name[i]).width + sp2;
        F(g, "500 34px Montserrat"); var wc = count ? g.measureText(count).width + 16 : 0; F(g, "700 32px Montserrat"); var ww = warn ? g.measureText(warn).width + 62 : 0;
        var wAll = Math.min(636, 24 + wn + wc + ww + 18);
        g.fillStyle = "rgba(18,24,50,.94)"; rr(g, 2, 10, wAll - 4, 76, 12); g.fill(); g.lineWidth = 2.5; g.strokeStyle = ok ? "#00E5B9" : (warn ? "#7A5C2E" : "#33407A"); rr(g, 2, 10, wAll - 4, 76, 12); g.stroke();
        g.textBaseline = "middle"; g.fillStyle = "#D5DBF0"; F(g, fn); for (var j = 0; j < name.length; j++) { g.fillText(name[j], x, 50); x += g.measureText(name[j]).width + sp2; }
        if (count) { g.fillStyle = "#8E9AC4"; F(g, "500 34px Montserrat"); g.fillText(count, x + 12, 50); x += wc; }
        if (warn) { x += 20; g.strokeStyle = "#F2A65A"; g.lineWidth = 3.5; g.lineJoin = "round"; g.beginPath(); g.moveTo(x + 14, 34); g.lineTo(x + 28, 62); g.lineTo(x, 62); g.closePath(); g.stroke(); g.fillStyle = "#F2A65A"; g.fillRect(x + 12.5, 44, 3, 9); g.fillRect(x + 12.5, 56, 3, 3); F(g, "700 32px Montserrat"); g.fillText(warn, x + 38, 50); }
        g.textBaseline = "alphabetic"; t.needsUpdate = true;
      };
      scene.add(sp); pills.push(sp); return sp;
    }
    function sizePill(sp) { var h = pillH * (sp.userData.big ? 1 : .82); sp.scale.set(h * 640 / 96, h, 1); }

    /* Plots, blocks, roads. */
    var SLATE = 0x616C8E, ORANGE = 0xF2A65A, TQ = 0x00E5B9, PERI = 0xA5B4FC;
    var blocks = { people: [], docs: [], modules: [], decisions: [] }, plots = {};
    var plateMat = new THREE.MeshBasicMaterial({ color: 0xC9D4FF, transparent: true, opacity: .07, depthWrite: false }), plateEdge = new THREE.LineBasicMaterial({ color: 0xC9D4FF, transparent: true, opacity: .34 });
    var edgeMat = new THREE.LineBasicMaterial({ color: 0xDCE3FF, transparent: true, opacity: .2 });
    function plot(kind, cx, cz, w, dp, n, cols, size, h) {
      var g = new THREE.PlaneGeometry(w, dp), m = new THREE.Mesh(g, plateMat); m.rotation.x = -Math.PI / 2; m.position.set(cx, .03, cz); scene.add(m);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), plateEdge));
      var rows = Math.ceil(n / cols), gap = size * .42, tw = cols * size + (cols - 1) * gap, td = rows * size + (rows - 1) * gap;
      var geo = new THREE.BoxGeometry(size, h, size), edges = new THREE.EdgesGeometry(geo);
      for (var i = 0; i < n; i++) {
        var c = i % cols, r = Math.floor(i / cols), mat = new THREE.MeshStandardMaterial({ color: SLATE, roughness: .72, metalness: .05, emissive: SLATE, emissiveIntensity: .06 });
        var b = new THREE.Mesh(geo, mat); b.position.set(cx - tw / 2 + size / 2 + c * (size + gap), .03 + h / 2, cz - td / 2 + size / 2 + r * (size + gap)); scene.add(b);
        b.add(new THREE.LineSegments(edges, edgeMat));
        blocks[kind].push({ m: b, mat: mat, h: h, top: V(b.position.x, .03 + h, b.position.z), i: i, kind: kind });
      }
      plots[kind] = { c: V(cx, 0, cz), w: w, d: dp, pill: pill(true) }; plots[kind].pill.position.set(cx - w / 2 + .2, .05, cz + dp / 2 + .5);
    }
    plot("people", -9.85, 4.6, 3.9, 3.9, 7, 3, .86, .36);
    plot("docs", -4.1, 2.2, 4.6, 3.6, 17, 5, .52, .24);
    plot("modules", 1.2, -.2, 4.9, 4.9, 16, 4, .82, .38);
    plot("decisions", 6.9, -2.6, 4.6, 3.2, 14, 5, .52, .24);
    var roadMat = new THREE.MeshBasicMaterial({ color: 0xDCE3FF, transparent: true, opacity: .13, depthWrite: false });
    function road(x1, z1, x2, z2, wd) { var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), m = new THREE.Mesh(new THREE.PlaneGeometry(len, wd || .34), roadMat); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(dz, dx); m.position.set((x1 + x2) / 2, .02, (z1 + z2) / 2); scene.add(m); }
    function link(A, B) { var a = plots[A], b = plots[B], x1 = a.c.x + a.w / 2, x2 = b.c.x - b.w / 2, xm = (x1 + x2) / 2, z1 = a.c.z, z2 = b.c.z; road(x1, z1, xm + .17, z1); road(xm, z1, xm, z2); road(xm - .17, z2, x2, z2); }
    link("people", "docs"); link("docs", "modules"); link("modules", "decisions");
    /* People own modules: the long way round, as on the map. */
    (function () { var p = plots.people, m = plots.modules, z0 = p.c.z - p.d / 2, zf = m.c.z - m.d / 2 - 1.1; road(p.c.x, z0, p.c.x, zf - .17); road(p.c.x - .17, zf, m.c.x + .17, zf); road(m.c.x, zf, m.c.x, m.c.z - m.d / 2); })();

    /* Which block is which record. */
    var MB = blocks.modules, DB = blocks.docs, PB = blocks.people, CB = blocks.decisions;
    var docOwner = []; MOD.forEach(function (nm, i) { for (var k = 0; k < DOCS[i]; k++) docOwner.push(i); });
    var fresh = [0, 2, 5].map(function (mi, k) { docOwner.push(mi); var b = DB[14 + k]; b.fresh = true; b.mod = mi; return b; });
    var decOf = []; MOD.forEach(function (nm, i) { for (var k = 0; k < DEC[i]; k++) decOf.push(i); });
    function arc(a, b, col, lift) {
      var mid = a.clone().lerp(b, .5); mid.y += lift + a.distanceTo(b) * .2; var pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(30);
      var l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, fog: false })); l.frustumCulled = false; scene.add(l); l.userData.n = pts.length; return l;
    }
    /* The ties of one record, packages/auth, picked out the way the map picks a record out. */
    var SEL = 1, ties = [];
    docOwner.forEach(function (mi, di) { if (mi === SEL && di < 14) ties.push(arc(DB[di].top, MB[SEL].top, PERI, .7)); });
    ties.push(arc(PB[OWNER[SEL]].top, MB[SEL].top, 0xF9A8D4, 1.0));
    decOf.forEach(function (mi, ci) { if (mi === SEL) ties.push(arc(CB[ci].top, MB[SEL].top, PERI, .7)); });
    var selRing = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.06, .5, 1.06)), new THREE.LineBasicMaterial({ color: PERI, transparent: true, opacity: 0, fog: false })); selRing.position.copy(MB[SEL].m.position); scene.add(selRing);
    var selPill = pill(false); selPill.position.copy(MB[SEL].top).add(V(.3, .5, 0));
    var freshTies = fresh.map(function (b) { return arc(b.top, MB[b.mod].top, TQ, .8); });
    var probPills = [0, 2, 5].map(function (mi) { var p = pill(false); p.position.copy(MB[mi].top).add(V(.35, .45, 0)); p.userData.mi = mi; return p; });
    var rulePill = pill(false); rulePill.position.set(plots.modules.c.x - 2.4, .05, plots.modules.c.z + 4.0);

    /* Screens stand on the map the way pages do: a card on a post over its plot. */
    var FACE_AZ = -0.74;
    var screens = [["per", V(3.6, 4.0, 2.2), 0x7DA2FF, "modules"], ["stat", V(3.6, 6.2, -5.6), 0x12B886, "decisions"], ["shelf", V(-6.6, 3.9, -.6), 0xFFB86B, "docs"]].map(function (s) {
      var tx = [faces[s[0]](false), faces[s[0]](true)], mat = new THREE.MeshBasicMaterial({ map: tx[0], transparent: true, opacity: 0, fog: false, side: THREE.DoubleSide }), m = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.31), mat);
      m.position.copy(s[1]); m.rotation.y = FACE_AZ; scene.add(m);
      var fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.78, 2.39)), new THREE.LineBasicMaterial({ color: s[2], transparent: true, opacity: 0, fog: false })); m.add(fr);
      var pc = plots[s[3]].c, pg = new THREE.BufferGeometry().setFromPoints([V(s[1].x, s[1].y - 1.16, s[1].z), V(pc.x, .03, pc.z)]), post = new THREE.Line(pg, new THREE.LineBasicMaterial({ color: 0xDCE3FF, transparent: true, opacity: 0, fog: false })); scene.add(post);
      var bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(8 * 6), 3));
      var beams = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: s[2], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); beams.frustumCulled = false; scene.add(beams);
      var gl = glow(s[2], 7, 0); gl.position.z = -.2; m.add(gl);
      return { kind: s[0], m: m, mat: mat, tx: tx, fr: fr, post: post, beams: beams, gl: gl, placed: -1 };
    });

    /* The agent: a presence on the map, and the sweep of its reading. */
    var agent = new THREE.Group(); agent.add(new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xC9B8FF, fog: false }))); agent.add(glow(0xB9A4FF, 3.6, .9)); scene.add(agent);
    var agentPill = pill(false);
    var ring = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0xB9A4FF, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; scene.add(ring);
    var allBlocks = PB.concat(DB, MB, CB), colT = new THREE.Color(), colA = new THREE.Color();

    /* ── the first screen, as glass you can look through ── */
    var appCanvas = document.createElement("canvas"), appTex = new THREE.CanvasTexture(appCanvas); appTex.minFilter = THREE.LinearFilter; appTex.generateMipmaps = false;
    var oScene = new THREE.Scene(), oCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var glass = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { tex: { value: appTex }, res: { value: new THREE.Vector2(1, 1) }, m: { value: new THREE.Vector2(0, 0) }, r: { value: 160 }, fade: { value: 1 }, zoom: { value: 1 } },
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: [
        "precision highp float;varying vec2 vUv;uniform sampler2D tex;uniform vec2 res;uniform vec2 m;uniform float r;uniform float fade;uniform float zoom;",
        "void main(){vec2 px=vUv*res;float d=distance(px,m);vec2 dir=(px-m)/max(d,1.);",
        " float band=1.-smoothstep(r,r+90.,d);",
        " vec2 uv=(px+dir*band*26.)/res;uv=(uv-m/res)/zoom+m/res;",
        " vec3 c=texture2D(tex,clamp(uv,0.,1.)).rgb;",
        " c*=mix(.78,1.,smoothstep(r,r+140.,d));",
        " float rim=exp(-pow((d-r)/7.,2.));float halo=exp(-pow((d-r)/34.,2.))*.35;",
        " c=mix(c,vec3(0.,.9,.73),clamp(rim+halo,0.,1.));",
        " float a=smoothstep(r-1.5,r+1.5,d);a=max(a,rim*.95);",
        " gl_FragColor=vec4(c,a*fade);}"].join("\n"),
    });
    oScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glass));

    /* The opening hole, as a share of the screen's short side: small enough that the map is a glimpse. */
    var HOLE_DESK = .13, HOLE_PHONE = .135, holeR = 0;

    /* ── the camera: from the map's own high angle, down into it ── */
    var K = [[V(-14.2, 17, 6.4), V(-3.2, 0, -4.6)], [V(-17.4, 12.6, 10.2), V(-5.6, 0, -1.2)], [V(-5.7, 4.8, 5.5), V(-.5, 0, -.5)], [V(-16.8, 9.4, 11.2), V(-4.6, 0, -.6)], [V(-15.5, 9.6, 13.4), V(-2.6, 2.2, -.6)], [V(-14.6, 8.4, 12.4), V(-2.8, 1.7, -.3)], [V(-21, 16, 13.2), V(-5.4, 1.6, -1.8)]];
    function pose(t, P, T) { var j = Math.min(NB - 2, Math.floor(t)), f = t - j; f = f * f * f * (f * (f * 6 - 15) + 10); P.lerpVectors(K[j][0], K[j + 1][0], f); T.lerpVectors(K[j][1], K[j + 1][1], f); }
    var vP = V(0, 0, 0), vT = V(0, 0, 0), vA = V(0, 0, 0), vB = V(0, 0, 0);

    /* ── size, the pointer, the fonts ── */
    var lastPtr = null, tapHole = null;
    var mx = port ? .5 : .74, my = port ? .25 : .56, mxS = mx, myS = my, ptrAt = -1e9, sizedW = 0, sizedH = 0;
    function layout(force) {
      var oldSpan = span, wasIn = window.scrollY <= oldSpan + 1, oldT = tTarget;
      measure();
      if (wasIn && Math.abs(span - oldSpan) > 1) { window.scrollTo({ top: Math.round(oldT / (NB - 1) * span), behavior: "instant" }); }
      read();
      if (!force && W === sizedW && H === sizedH) return;
      sizedW = W; sizedH = H;
      renderer.setSize(W, H, false); cam.aspect = W / H; cam.fov = port ? 58 : 40; cam.updateProjectionMatrix();
      drawApp(appCanvas, W, H, Math.min(dpr, 1.5)); appTex.needsUpdate = true; glass.uniforms.res.value.set(W, H);
      pillH = (port ? 30 : 38) / H * 2 * Math.tan(cam.fov * Math.PI / 360);
    }
    var resizing = 0;
    window.addEventListener("resize", function () { if (resizing) cancelAnimationFrame(resizing); resizing = requestAnimationFrame(function () { resizing = 0; layout(false); wake(); }); });
    window.addEventListener("pointermove", function (e) { mx = e.clientX / W; my = e.clientY / H; ptrAt = now(); lastPtr = [e.clientX, e.clientY]; wake(8000); }, { passive: true });
    canvas.addEventListener("pointerdown", function (e) { if (e.pointerType !== "touch") return; tapHole = Math.hypot(e.clientX - mxS * W, e.clientY - myS * H) <= holeR; mx = e.clientX / W; my = e.clientY / H; ptrAt = now(); wake(8000); }, { passive: true });
    function redrawText() {
      pills.forEach(function (p) { p.reset(); });
      screens.forEach(function (s) { var fixedNow = s.mat.map === s.tx[1]; s.tx.forEach(function (t) { t.dispose(); }); s.tx = [faces[s.kind](false), faces[s.kind](true)]; s.mat.map = s.tx[fixedNow ? 1 : 0]; s.mat.needsUpdate = true; });
      layout(true); wake();
    }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", redrawText);

    /* A slow machine draws fewer pixels rather than fewer frames. */
    var slowFrames = 0;
    function pace(dt) {
      if (dt > 0.026) slowFrames++; else slowFrames = Math.max(0, slowFrames - 2);
      if (slowFrames > 40 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); slowFrames = 0; }
    }

    /* ── a frame ── */
    var lastFixed = null, drewAt = null;
    frameFn = function (dt, changed) {
      var t = reduce ? Math.round(tNow) : tNow, a = amb, busy = false;
      drewAt = { t: tNow, scrollY: window.scrollY, span: span };
      /* Left alone, the hole drifts; with the drift spent it comes to rest. */
      if (now() - ptrAt > 3500) { var ax = port ? .5 : .74, ay = port ? .25 : .56; mx = ax + Math.cos(time * .5) * (port ? .22 : .13) * a; my = ay + Math.sin(time * .8) * (port ? .08 : .2) * a; }
      var ke = reduce ? 1 : 1 - Math.exp(-dt * 9); mxS += (mx - mxS) * ke; myS += (my - myS) * ke;
      if (Math.abs(mx - mxS) > 0.0005 || Math.abs(my - myS) > 0.0005) busy = true;

      /* Covered by the questions: nothing to draw. */
      if (window.scrollY >= trackH) return busy;
      if (changed || busy) pace(dt);
      if (pending) { hoverAt(pending[0], pending[1]); pending = null; }
      lifted = false;
      if (shown && Math.round(t) !== placedBeat) placeCard();

      pose(clamp(t, 0, NB - 1), vP, vT);
      if (port) { vP.sub(vT).multiplyScalar(1.35).add(vT); var ph = 1 - sm(t, .45, 1); if (ph > 0) { vB.set(-1.9, 0, 2.9); vT.lerp(vB, ph); vB.set(-13.4, 19.5, 14.4); vP.lerp(vB, ph); } }
      var par = 1 - sm(t, .9, 1.4) * .55; vA.set(1, 0, 1).normalize(); vP.addScaledVector(vA, (mxS - .5) * 2.2 * par); vP.y -= (myS - .5) * 1.4 * par;
      cam.position.copy(vP); cam.lookAt(vT);

      var fixed = t > 4.62; if (fixed !== lastFixed) { lastFixed = fixed; fixedNow = fixed; screens.forEach(function (s) { s.mat.map = s.tx[fixed ? 1 : 0]; s.mat.needsUpdate = true; }); if (shown && shown.fresh && !fixed) choose(null); else if (shown) showCard(shown, false, true); }
      /* What is wrong shows when the story comes to it, and goes when the press fixes it. */
      var warnIn = sm(t, 1.35, 1.8);
      var fx = sm(t, 4.5, 4.95), flash = Math.max(0, 1 - Math.abs(t - 4.72) / .3);

      /* The agent's reading sweeps the map. */
      var sweep = clamp((t - 2.45) / .8), R = sweep * 30, scanning = t > 2.43 && sweep < 1;
      agent.position.set(.6, 1.6 + Math.sin(time * 1.6) * .12 * a, 5.2); agent.visible = t > 2.2 && t < 3.5;
      ring.position.x = agent.position.x; ring.position.z = agent.position.z; ring.scale.setScalar(Math.max(.01, R)); ring.material.opacity = scanning ? .8 * (1 - sweep * .7) : 0;

      for (var i = 0; i < allBlocks.length; i++) {
        var b = allBlocks[i], plain = true, sy = 1;
        if (b.kind === "modules" && MISSING[b.i]) { colT.setHex(SLATE); colA.setHex(ORANGE); colT.lerp(colA, warnIn); colA.setHex(SLATE); colT.lerp(colA, fx); if (flash > 0) { colA.setHex(TQ); colT.lerp(colA, flash * .9); } b.mat.color.copy(colT); b.mat.emissive.copy(colT); b.mat.emissiveIntensity = .38 * warnIn * (1 - fx) + .06 + flash * .6 + warnIn * (1 - fx) * .12 * Math.sin(time * 3.4 + b.i) * a; plain = false; }
        if (b.fresh) { sy = Math.max(.001, fx); colT.setHex(SLATE); if (flash > 0) { colA.setHex(TQ); colT.lerp(colA, flash); } b.mat.color.copy(colT); b.mat.emissive.copy(colT); b.mat.emissiveIntensity = .1 + flash * .8; plain = false; b.m.visible = fx > .002; }
        if (plain) { b.mat.color.setHex(SLATE); b.mat.emissive.setHex(SLATE); b.mat.emissiveIntensity = .06; }
        if (scanning) { vA.set(b.top.x - agent.position.x, 0, b.top.z - agent.position.z); var hit = Math.max(0, 1 - Math.abs(vA.length() - R) / 1.3); if (hit > 0) { b.mat.emissive.setHex(0xB9A4FF); b.mat.emissiveIntensity = .1 + hit * 1.3; } }
        var lift = b === hovered ? .09 : 0;
        b.lift = b.lift === undefined ? 0 : b.lift + (lift - b.lift) * (reduce ? 1 : 1 - Math.exp(-dt * 14));
        if (Math.abs(lift - b.lift) > .001) lifted = true;
        b.m.scale.y = sy; b.m.position.y = .03 + b.h * sy / 2 + b.lift;
      }
      if (lifted) busy = true;
      /* The record pressed: its ring, its ties. */
      if (picked) { pickRing.position.set(picked.b.m.position.x, picked.b.m.position.y, picked.b.m.position.z); pickRing.visible = picked.b.m.visible; }
      hoverPill.material.opacity = hovered ? 1 : 0;
      if (hovered) { hoverPill.position.copy(hovered.top); hoverPill.position.y += .35 + hovered.lift; hoverPill.position.x += .25; sizePill(hoverPill); }

      /* The map's labels. */
      var showK = sm(t, .55, .95);
      plots.people.pill.set("PEOPLE", "7", "", false); plots.docs.pill.set("DOCS", fixed ? "17" : "14", "", fixed && t < 5.5); plots.modules.pill.set("MODULES", "16", fixed || warnIn < .5 ? "" : "3", fixed && t < 5.5); plots.decisions.pill.set("DECISION RECORDS", "14", "", false);
      ["people", "docs", "modules", "decisions"].forEach(function (k) { sizePill(plots[k].pill); plots[k].pill.material.opacity = showK; });
      var pp = sm(t, 1.6, 1.9) * (1 - sm(t, 2.4, 2.7)) * (1 - fx);
      probPills.forEach(function (p) { p.set(MOD[p.userData.mi], "", "no doc", false); sizePill(p); p.material.opacity = pp; });
      rulePill.set(fixed ? "rule holds: every module has a doc" : "rule: every module has a doc", "", fixed ? "" : "3", fixed); sizePill(rulePill); rulePill.material.opacity = Math.max(pp, sm(t, 4.5, 4.75) * (1 - sm(t, 5.4, 5.7)));
      /* One record picked out, with its ties. */
      var sel = picked ? 0 : sm(t, .75, 1.05) * (1 - sm(t, 1.5, 1.75)); selRing.material.opacity = sel; selPill.set(MOD[SEL], "", "", false); sizePill(selPill); selPill.material.opacity = sel;
      ties.forEach(function (l, n) { l.material.opacity = sel * .95; l.geometry.setDrawRange(0, Math.ceil(l.userData.n * sm(t, .8 + n * .02, 1.05 + n * .02))); });
      freshTies.forEach(function (l) { l.material.opacity = fx * (1 - sm(t, 5.5, 5.8) * .6); l.geometry.setDrawRange(0, Math.ceil(l.userData.n * sm(t, 4.62, 4.9))); });
      agentPill.position.copy(agent.position); agentPill.position.x += .4; agentPill.position.y += .3; agentPill.set("your agent, reading the map", "", "", false); sizePill(agentPill); agentPill.material.opacity = agent.visible ? sm(t, 2.3, 2.5) * (1 - sm(t, 3.3, 3.5)) : 0;

      /* Screens on posts, each beamed to the blocks it shows. */
      var sIn = sm(t, 3.45, 3.9);
      screens.forEach(function (s) {
        s.mat.opacity = sIn; s.fr.material.opacity = sIn; s.post.material.opacity = sIn * .5; s.gl.material.opacity = sIn * .16 + flash * .5; s.m.scale.setScalar(.6 + .4 * sIn); s.m.visible = sIn > .01;
        s.beams.material.opacity = sIn * .42;
        if (sIn > .01 && s.placed !== sIn) {
          s.placed = sIn; s.m.updateMatrixWorld();
          var bp = s.beams.geometry.attributes.position;
          for (var r = 0; r < 8; r++) { vA.set(-1.6 + (r % 4) * 1.05, -1.1, 0.02); s.m.localToWorld(vA); var mn = MB[r].top; bp.setXYZ(r * 2, vA.x, vA.y, vA.z); bp.setXYZ(r * 2 + 1, mn.x, mn.y, mn.z); }
          bp.needsUpdate = true;
        }
      });

      /* The glass. */
      var open = sm(t, .12, .95), gone = sm(t, .8, 1.0);
      var rad = lerp(Math.min(W, H) * (port ? HOLE_PHONE : HOLE_DESK), Math.hypot(W, H) * 1.05, open * open);
      holeR = rad;
      glass.uniforms.m.value.set(mxS * W, (1 - myS) * H); glass.uniforms.r.value = rad; glass.uniforms.fade.value = 1 - gone; glass.uniforms.zoom.value = 1 + open * .5;

      renderer.clear(); renderer.render(scene, cam);
      if (gone < .999) { renderer.clearDepth(); renderer.render(oScene, oCam); }
      return busy;
    };


    /* ── the records the map holds, one per block, and what each is tied to ── */
    var fixedNow = false, REC = {}, BYKIND = { modules: [], docs: [], people: [], decisions: [] };
    var NOUN = { modules: "Module", docs: "Doc", people: "Person", decisions: "Decision record" };
    var PLURAL = { modules: "Modules", docs: "Docs", people: "People", decisions: "Decision records" };
    function record(kind, key, name, b, extra) {
      var r = { id: kind + ":" + key, kind: kind, name: name, b: b };
      for (var k in extra) r[k] = extra[k];
      b.rec = r; b.m.userData.block = b; REC[r.id] = r; BYKIND[kind].push(r);
      return r;
    }
    MOD.forEach(function (m, i) { record("modules", i, m, MB[i], { mi: i }); });
    var nth = {};
    docOwner.forEach(function (mi, di) { nth[mi] = (nth[mi] || 0) + 1; record("docs", di, MOD[mi] + (nth[mi] === 1 ? " guide" : " runbook"), DB[di], { mi: mi, fresh: di >= 14 }); });
    PPL.forEach(function (p, i) { record("people", i, p, PB[i], { pi: i }); });
    decOf.forEach(function (mi, ci) { record("decisions", ci, "ADR-" + String(ci + 1).padStart(4, "0"), CB[ci], { mi: mi }); });
    /* A guide the press writes is a record only once it is written. */
    function live(r) { return !r.fresh || fixedNow; }
    function tiesOf(r) {
      var out = [];
      if (r.kind === "modules") {
        out.push(["Owner", REC["people:" + OWNER[r.mi]]]);
        BYKIND.docs.forEach(function (d) { if (d.mi === r.mi && live(d)) out.push(["Docs", d]); });
        BYKIND.decisions.forEach(function (d) { if (d.mi === r.mi) out.push(["Decisions", d]); });
      } else if (r.kind === "people") {
        BYKIND.modules.forEach(function (m) { if (OWNER[m.mi] === r.pi) out.push(["Owns", m]); });
      } else out.push([r.kind === "docs" ? "Covers" : "Affects", REC["modules:" + r.mi]]);
      return out;
    }
    function problemOf(r) { return r.kind === "modules" && MISSING[r.mi] && !fixedNow ? "No doc covers it. The rule every module has a doc offers the act that fixes it: write its guide." : ""; }
    function factsOf(r) {
      var ties = tiesOf(r), count = function (label) { return ties.filter(function (t) { return t[0] === label; }).length; };
      if (r.kind === "modules") return [["Owner", PPL[OWNER[r.mi]]], ["Docs", String(count("Docs"))], ["Decisions", String(count("Decisions"))]];
      if (r.kind === "people") return [["Owns", ties.length + (ties.length === 1 ? " module" : " modules")]];
      if (r.kind === "docs") return [["Covers", MOD[r.mi]]].concat(r.fresh ? [["Written", "by the press in scene five"]] : []);
      return [["Affects", MOD[r.mi]]];
    }

    /* ── the record pressed: a ring round its block, its ties drawn to the records it links ── */
    var picked = null, pickArcs = [], shown = null, placedBeat = -1;
    var pickRing = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: TQ, transparent: true, opacity: .95, fog: false }));
    pickRing.visible = false; scene.add(pickRing);
    var hoverPill = pill(false);
    var TIE = { people: 0xF9A8D4, docs: PERI, decisions: PERI, modules: TQ };
    function pick3d(r) {
      pickArcs.forEach(function (l) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
      pickArcs = []; picked = r;
      if (!r) { pickRing.visible = false; return; }
      var size = r.b.m.geometry.parameters.width;
      pickRing.scale.set(size * 1.32, r.b.h + .16, size * 1.32);
      tiesOf(r).forEach(function (t) { var l = arc(t[1].b.top, r.b.top, TIE[t[1].kind], .7); l.material.opacity = .95; pickArcs.push(l); });
    }

    /* ── the card: the page's own, anchored to a corner, filled once per press ── */
    var card = document.getElementById("card"), cardKind = document.getElementById("card-kind"), cardName = document.getElementById("card-name");
    var cardBody = document.getElementById("card-body"), said = document.getElementById("record-said"), toggle = document.getElementById("records-toggle"), listEl = document.getElementById("records-list");
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function recButton(r, cls) { var b = el("button", cls, r.name); b.type = "button"; b.addEventListener("click", function () { choose(r, "keyboard"); }); return b; }
    function showCard(r, focus, quiet) {
      var held = card.contains(document.activeElement) && document.activeElement !== cardName;
      shown = r;
      cardBody.textContent = "";
      if (r.plot) {
        var all = BYKIND[r.kind].filter(live);
        cardKind.textContent = "A plot on the map";
        cardName.textContent = PLURAL[r.kind];
        cardBody.appendChild(el("p", "card-line", all.length + " records, a block each. Press one to see what it is tied to."));
        var row = el("div", "card-ties");
        all.forEach(function (x) { row.appendChild(recButton(x, "tie")); });
        cardBody.appendChild(row);
        if (!quiet) said.textContent = "The " + PLURAL[r.kind].toLowerCase() + " plot: " + all.length + " records.";
      } else {
        cardKind.textContent = NOUN[r.kind];
        cardName.textContent = r.name;
        var dl = el("dl", "card-facts"), facts = factsOf(r);
        facts.forEach(function (f) { var d = el("div"); d.appendChild(el("dt", "", f[0])); d.appendChild(el("dd", "", f[1])); dl.appendChild(d); });
        cardBody.appendChild(dl);
        var problem = problemOf(r);
        if (problem) cardBody.appendChild(el("p", "card-problem", problem));
        var groups = {};
        tiesOf(r).forEach(function (t) {
          if (!groups[t[0]]) { cardBody.appendChild(el("p", "card-label", t[0])); groups[t[0]] = cardBody.appendChild(el("div", "card-ties")); }
          groups[t[0]].appendChild(recButton(t[1], "tie"));
        });
        if (!quiet) said.textContent = NOUN[r.kind] + " " + r.name + " selected. " + facts.map(function (f) { return f[0] + ": " + f[1]; }).join(". ") + "." + (problem ? " " + problem : "");
      }
      card.hidden = false;
      placeCard();
      if (focus || held) cardName.focus();
    }
    function hideCard() {
      var had = card.contains(document.activeElement);
      shown = null; card.hidden = true; said.textContent = "";
      /* The keyboard never falls to the page when the card it was in goes. */
      if (had) toggle.focus();
    }
    /* Beside the block, never over it: the corner across the screen from where the block stands. */
    function placeCard() {
      placedBeat = Math.round(tNow);
      if (!shown || !shown.b) { card.classList.remove("left"); return; }
      vA.copy(shown.b.top).project(cam);
      card.classList.toggle("left", (vA.x + 1) / 2 > .55);
    }
    /* The scene a record pressed at the opening belongs in: what is wrong for a module with no doc, else the record and its ties. */
    function fitting(r) { return problemOf(r) ? 2 : 1; }
    function choose(r, via) {
      if (!r) { pick3d(null); hideCard(); wake(0); return; }
      var opening = tTarget < .5;
      pick3d(r.plot ? null : r);
      showCard(r, via === "keyboard");
      if (opening && !r.plot) goBeat(fitting(r));
      wake(0);
    }
    document.getElementById("card-close").addEventListener("click", function () { choose(null); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!listEl.hidden) { var inList = listEl.contains(document.activeElement); openList(false); if (inList) toggle.focus(); return; }
      if (picked || shown) choose(null);
    });

    /* ── every record, as a list a keyboard and a screen reader can reach ── */
    ["modules", "docs", "people", "decisions"].forEach(function (kind) {
      var group = el("div", "records-group");
      group.appendChild(el("p", "records-kind", PLURAL[kind]));
      var ul = el("ul");
      BYKIND[kind].forEach(function (r) { if (r.fresh) return; var li = el("li"); li.appendChild(recButton(r, "rec")); ul.appendChild(li); });
      group.appendChild(ul);
      listEl.appendChild(group);
    });
    function openList(open) { listEl.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); }
    toggle.addEventListener("click", function () { openList(listEl.hidden); });
    listEl.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("button")) openList(false); });

    /* ── pointing at the map ── */
    onScroll = function () { if (lastPtr) pending = lastPtr; };
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hovered = null, pending = null, lifted = false;
    var pickable = allBlocks.map(function (b) { return b.m; });
    var plotPills = ["people", "docs", "modules", "decisions"].map(function (k) { plots[k].pill.userData.kind = k; return plots[k].pill; });
    /* What is under a point of the screen: a block, a plot's label, or, at the opening, a row of the drawn table. */
    function hitAt(x, y) {
      var t = tNow, glassUp = t < .95;
      if (glassUp && Math.hypot(x - mxS * W, y - myS * H) > holeR) {
        var z = glass.uniforms.zoom.value, hx = mxS * W, hy = myS * H; x = hx + (x - hx) / z; y = hy + (y - hy) / z;
        for (var i = 0; i < appRows.length; i++) { var row = appRows[i]; if (x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h) return { b: MB[row.mi] }; }
        return null;
      }
      ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, cam);
      var hits = ray.intersectObjects(pickable, false);
      for (var j = 0; j < hits.length; j++) if (hits[j].object.visible) return { b: hits[j].object.userData.block };
      if (t > .9) { var pills = ray.intersectObjects(plotPills, false); if (pills.length) return { kind: pills[0].object.userData.kind }; }
      return null;
    }
    function hoverAt(x, y) {
      var h = hitAt(x, y);
      hovered = h && h.b ? h.b : null;
      if (hovered) hoverPill.set(hovered.rec.name, "", problemOf(hovered.rec) ? "no doc" : "", false);
      var cursor = h ? "pointer" : "";
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    }
    canvas.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; pending = [e.clientX, e.clientY]; wake(8000); });
    canvas.addEventListener("pointerleave", function () { pending = null; hovered = null; canvas.style.cursor = ""; wake(0); });
    /* A tap or a click selects; a drag is the page's, and scrolls it. */
    canvas.addEventListener("click", function (e) {
      if (tapHole === false && tNow < .95) { tapHole = null; return; }
      tapHole = null;
      var h = hitAt(e.clientX, e.clientY);
      if (h && h.kind) choose({ plot: true, kind: h.kind }, "map");
      else if (h && h.b) choose(h.b.rec, "map");
      else if (picked || shown) choose(null);
    });

    layout(true);
    /* For the harness and the share image: put the story at a scene, and the hole where it should be. */
    window.__home = {
      at: function (v, x, y) { window.scrollTo({ top: Math.round(span * v / (NB - 1)), behavior: "instant" }); read(); if (x !== undefined) { mx = mxS = x; my = myS = y; ptrAt = now() + 1e12; } wake(); },
      state: function () {
        return {
          t: tNow, scrolled: clamp(window.scrollY / span) * (NB - 1), running: raf !== 0, dpr: dpr, webgl2: renderer.capabilities.isWebGL2, derivatives: deriv,
          hole: holeR / Math.min(W, H), drew: drewAt, picked: picked ? picked.id : null, hovered: hovered ? hovered.rec.id : null, cursor: canvas.style.cursor || "",
        };
      },
      /* Where a record's block is on the screen now, in CSS pixels. */
      screenOf: function (id) { var r = REC[id]; if (!r) return null; vA.copy(r.b.top); vA.y -= r.b.h / 2; vA.project(cam); return { x: (vA.x + 1) / 2 * W, y: (1 - vA.y) / 2 * H }; },
    };
    root.classList.add("drawn");
    wake(20000);
  }
})();
