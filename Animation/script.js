/* app.js
   Advanced Animation Playground
   - Multi-track sequencer
   - Draggable keyframes with snapping & zoom
   - Track reordering (drag & drop)
   - Mute / Solo per track
   - Easing graph editor with draggable control points + preview dot
   - Export CSS / JS
*/

class Sequencer {
  constructor() {
    // Elements & initial state
    this.tracks = {
      box: { label: "box", color: "#7c5cff", keyframes: [] },
      circle: { label: "circle", color: "#ff7aa2", keyframes: [] },
      card: { label: "card", color: "#25c6ff", keyframes: [] },
    };
    this.selected = { track: "box", kf: null };
    this.animations = {}; // Web Animations API instances
    this.options = {
      duration: 1200,
      easing: "ease",
      iterations: 1,
      direction: "normal",
      fill: "both",
      playbackRate: 1,
    };
    this.zoom = 1; // 1..8
    this.snap = 0.05;
    this.solo = null;
    this.muted = { box: false, circle: false, card: false };

    // DOM refs
    this.dom = {
      duration: document.getElementById("duration"),
      easingSelect: document.getElementById("easingSelect"),
      iterations: document.getElementById("iterations"),
      direction: document.getElementById("direction"),
      fill: document.getElementById("fill"),
      cubicInput: document.getElementById("cubicInput"),
      easingCanvas: document.getElementById("easingCanvas"),
      playEase: document.getElementById("playEase"),
      resetEase: document.getElementById("resetEase"),

      zoomInput: document.getElementById("zoom"),
      zoomVal: document.getElementById("zoomVal") || null,
      snapSelect: document.getElementById("snap"),

      targetSelect: document.getElementById("targetSelect"),
      propInput: document.getElementById("propInput"),
      valInput: document.getElementById("valInput"),
      colorPicker: document.getElementById("colorPicker"),
      offsetInput: document.getElementById("offsetInput"),
      addKF: document.getElementById("addKF"),

      timelineInner: document.getElementById("timelineInner"),
      timelineViewport: document.getElementById("timelineViewport"),
      previewStage: document.getElementById("previewStage"),

      kfEditor: document.getElementById("kfEditor"),
      generatedCode: document.getElementById("generatedCode"),
      copyCode: document.getElementById("copyCode"),

      playAll: document.getElementById("playAll"),
      pauseAll: document.getElementById("pauseAll"),
      restartAll: document.getElementById("restartAll"),
      exportCSS: document.getElementById("exportCSS"),
      exportJS: document.getElementById("exportJS"),
    };

    // fallback for older markup where zoomVal not present
    if (!this.dom.zoomVal) {
      this.dom.zoomVal = document.createElement("div");
      this.dom.zoomVal.style.color = "#9aa7bf";
      this.dom.zoomVal.style.fontSize = "12px";
      this.dom.zoomVal.textContent = `${this.zoom}×`;
    }

    // easing control points (x1,y1,x2,y2) default to ease
    this.bezier = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 };

    // references
    this.ctx = this.dom.easingCanvas.getContext("2d");
    this.draggingCtrl = null;

    // initialize
    this._populateTargetSelect();
    this._bindUI();
    this._renderTracks();
    this._drawEasing();
  }

  /* ---------- UI and binding ----------- */
  _populateTargetSelect() {
    const sel = this.dom.targetSelect;
    sel.innerHTML = "";
    for (const t of Object.keys(this.tracks)) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.text = t;
      sel.appendChild(opt);
    }
    sel.value = this.selected.track;
  }

  _bindUI() {
    // options
    this.dom.duration.addEventListener(
      "change",
      () => (this.options.duration = Number(this.dom.duration.value || 0))
    );
    this.dom.easingSelect.addEventListener("change", () => {
      const v = this.dom.easingSelect.value;
      if (v !== "custom") {
        this.options.easing = v;
        // map CSS named easings to cubic if desired (we still allow named)
        this._applyEasingPreset(v);
      } else {
        // enable cubic input
        this.options.easing = `cubic-bezier(${this.bezier.x1},${this.bezier.y1},${this.bezier.x2},${this.bezier.y2})`;
      }
      this._drawEasing();
    });
    this.dom.iterations.addEventListener(
      "change",
      () => (this.options.iterations = Number(this.dom.iterations.value || 1))
    );
    this.dom.direction.addEventListener(
      "change",
      () => (this.options.direction = this.dom.direction.value)
    );
    this.dom.fill.addEventListener(
      "change",
      () => (this.options.fill = this.dom.fill.value)
    );

    // zoom + snap
    const zoomEl = document.getElementById("zoom");
    if (zoomEl) {
      zoomEl.addEventListener("input", (e) => {
        this.zoom = Number(e.target.value);
        if (typeof this.dom.zoomVal !== "undefined")
          this.dom.zoomVal.textContent = `${this.zoom}×`;
        this._updateTimelineZoom();
      });
    }
    const snapEl = document.getElementById("snap");
    if (snapEl) {
      snapEl.addEventListener("change", (e) => {
        this.snap = Number(e.target.value);
      });
    }

    // easing editor canvas
    this.dom.easingCanvas.addEventListener("pointerdown", (e) =>
      this._onEasingPointerDown(e)
    );
    window.addEventListener("pointermove", (e) => this._onEasingPointerMove(e));
    window.addEventListener("pointerup", () => this._onEasingPointerUp());
    this.dom.cubicInput.addEventListener("change", () => {
      const parts = this.dom.cubicInput.value
        .split(",")
        .map((s) => Number(s.trim()));
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        this.bezier = {
          x1: parts[0],
          y1: parts[1],
          x2: parts[2],
          y2: parts[3],
        };
        this.options.easing = `cubic-bezier(${parts.join(",")})`;
        this._drawEasing();
      } else alert("Enter 4 numbers: x1,y1,x2,y2");
    });
    document
      .getElementById("playEase")
      .addEventListener("click", () => this._playEasingPreview());
    document.getElementById("resetEase").addEventListener("click", () => {
      this.bezier = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
      this.dom.cubicInput.value = "";
      this._drawEasing();
    });

    // add keyframe UI
    this.dom.addKF.addEventListener("click", () => this._onAddKeyframe());
    this.dom.propInput.addEventListener("input", () => {
      const v = this.dom.propInput.value.toLowerCase();
      this.dom.colorPicker.style.display = /color|background|border/.test(v)
        ? "inline-block"
        : "none";
    });
    this.dom.colorPicker.addEventListener(
      "input",
      (e) => (this.dom.valInput.value = e.target.value)
    );

    // playback
    this.dom.playAll.addEventListener("click", () => this.playAll());
    this.dom.pauseAll.addEventListener("click", () => this.pauseAll());
    this.dom.restartAll.addEventListener("click", () => this.restartAll());

    // exports
    this.dom.exportCSS.addEventListener(
      "click",
      () => (this.dom.generatedCode.textContent = this.exportCSS())
    );
    this.dom.exportJS.addEventListener(
      "click",
      () => (this.dom.generatedCode.textContent = this.exportJS())
    );
    this.dom.copyCode &&
      this.dom.copyCode.addEventListener("click", () =>
        navigator.clipboard?.writeText(this.dom.generatedCode.textContent)
      );

    // track reordering: use dragstart/drop on track rows (delegated)
    this.dom.timelineInner.addEventListener("dragstart", (e) => {
      const tr = e.target.closest(".track-row");
      if (!tr) return;
      e.dataTransfer.setData("text/track", tr.dataset.track);
      tr.classList.add("dragging");
    });
    this.dom.timelineInner.addEventListener("dragend", (e) => {
      const tr = e.target.closest(".track-row");
      if (tr) tr.classList.remove("dragging");
    });
    this.dom.timelineInner.addEventListener("dragover", (e) => {
      e.preventDefault();
      const tr = e.target.closest(".track-row");
      if (!tr) return;
      const dragging = this.dom.timelineInner.querySelector(
        ".track-row.dragging"
      );
      if (!dragging || dragging === tr) return;
      const rect = tr.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) tr.before(dragging);
      else tr.after(dragging);
    });
    this.dom.timelineInner.addEventListener("drop", (e) => {
      e.preventDefault();
      // after DOM rearranged, update internal track order
      this._rebuildTracksFromDOM();
    });
  }

  _applyEasingPreset(name) {
    const map = {
      linear: [0, 0, 1, 1],
      ease: [0.25, 0.1, 0.25, 1],
      "ease-in": [0.42, 0, 1, 1],
      "ease-out": [0, 0, 0.58, 1],
      "ease-in-out": [0.42, 0, 0.58, 1],
    };
    if (map[name]) {
      const [x1, y1, x2, y2] = map[name];
      this.bezier = { x1, y1, x2, y2 };
      this.dom.cubicInput.value = `${x1},${y1},${x2},${y2}`;
    }
  }

  /* ---------- Timeline rendering & track DOM ---------- */
  _renderTracks() {
    const inner = this.dom.timelineInner;
    inner.innerHTML = ""; // clear
    for (const [id, track] of Object.entries(this.tracks)) {
      const row = document.createElement("div");
      row.className = "track-row";
      row.draggable = true;
      row.dataset.track = id;

      // header portion (track handle)
      const handleBox = document.createElement("div");
      handleBox.className = "track-handle";
      handleBox.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <div class="track-color" style="background:${track.color}"></div>
        <div style="font-weight:700">${track.label}</div>
      </div>`;

      // controls (mute/solo)
      const controls = document.createElement("div");
      controls.className = "track-controls";
      const muteBtn = document.createElement("button");
      muteBtn.className = "btn ghost";
      muteBtn.innerText = this.muted[id] ? "Unmute" : "Mute";
      muteBtn.addEventListener("click", () => {
        this.muted[id] = !this.muted[id];
        this._renderTracks();
      });
      const soloBtn = document.createElement("button");
      soloBtn.className = "btn ghost";
      soloBtn.innerText = this.solo === id ? "Unsolo" : "Solo";
      soloBtn.addEventListener("click", () => {
        this.solo = this.solo === id ? null : id;
        this._renderTracks();
      });
      controls.appendChild(muteBtn);
      controls.appendChild(soloBtn);

      // track bar (timeline)
      const trackBarWrap = document.createElement("div");
      trackBarWrap.style.flex = "1";
      const trackBar = document.createElement("div");
      trackBar.className = "track";
      trackBar.dataset.track = id;
      trackBar.style.minWidth = 1000 * this.zoom + "px"; // inner width scales with zoom
      trackBar.ondblclick = (e) => {
        // add keyframe at clicked position for selected track
        const rect = trackBar.getBoundingClientRect();
        const pct = Math.min(
          1,
          Math.max(0, (e.clientX - rect.left) / rect.width)
        );
        const snapped = this._snap(pct);
        // default property attempt
        const prop = this.dom.propInput.value || "transform";
        const val =
          this.dom.valInput.value ||
          (prop === "opacity" ? "0" : "translateX(0px)");
        this.tracks[id].keyframes.push({
          offset: Number(snapped.toFixed(3)),
          [prop]: val,
        });
        this.tracks[id].keyframes.sort((a, b) => a.offset - b.offset);
        this._renderTracks();
      };

      // append keyframe handles
      for (let i = 0; i < track.keyframes.length; i++) {
        const kf = track.keyframes[i];
        const el = document.createElement("div");
        el.className = "kf-handle";
        el.style.left = kf.offset * 100 + "%";
        el.style.background = track.color;
        el.title = `${Math.round(kf.offset * 100)}%`;
        el.draggable = false;
        // pointer interaction for drag
        el.addEventListener("pointerdown", (e) =>
          this._handlePointerDown(e, el, id, i)
        );
        el.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this._openKeyframeEditor(id, i);
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          this._selectKeyframe(id, i);
        });
        trackBar.appendChild(el);
      }

      trackBarWrap.appendChild(trackBar);
      row.appendChild(handleBox);
      row.appendChild(trackBarWrap);
      row.appendChild(controls);
      this.dom.timelineInner.appendChild(row);
    }
  }

  _rebuildTracksFromDOM() {
    // read DOM order and reorder this.tracks object accordingly
    const newOrder = {};
    this.dom.timelineInner.querySelectorAll(".track-row").forEach((row) => {
      const t = row.dataset.track;
      newOrder[t] = this.tracks[t];
    });
    this.tracks = newOrder;
    this._renderTracks();
  }

  /* ---------- Pointer drag for keyframes ---------- */
  _handlePointerDown(ev, handleEl, trackId, idx) {
    ev.preventDefault();
    handleEl.setPointerCapture(ev.pointerId);
    const startX = ev.clientX;
    const trackEl = handleEl.parentElement;
    const rect = trackEl.getBoundingClientRect();
    const onMove = (e) => {
      const pct = Math.min(
        1,
        Math.max(0, (e.clientX - rect.left) / rect.width)
      );
      const snapped = this._snap(pct);
      this.tracks[trackId].keyframes[idx].offset = Number(snapped.toFixed(3));
      handleEl.style.left = snapped * 100 + "%";
      handleEl.title = `${Math.round(snapped * 100)}%`;
    };
    const onUp = (e) => {
      try {
        handleEl.releasePointerCapture(ev.pointerId);
      } catch (e) {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // after drag, sort keyframes
      this.tracks[trackId].keyframes.sort((a, b) => a.offset - b.offset);
      this._renderTracks();
      this._recreateAnimationsDebounced();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  _snap(value) {
    const s = this.snap || 0.01;
    return Math.round(value / s) * s;
  }

  _updateTimelineZoom() {
    // scale the min-width of track bars to simulate zoom; re-render tracks
    this._renderTracks();
  }

  /* ---------- keyframe editor (right panel) ---------- */
  _selectKeyframe(trackId, idx) {
    this.selected = { track: trackId, kf: idx };
    this._openKeyframeEditor(trackId, idx);
  }

  _openKeyframeEditor(trackId, idx) {
    const editor = this.dom.kfEditor;
    const kf = this.tracks[trackId].keyframes[idx];
    if (!kf) {
      editor.innerHTML = `<div class="muted">No keyframe selected</div>`;
      return;
    }
    editor.innerHTML = "";
    const title = document.createElement("div");
    title.innerHTML = `<strong>${trackId} — ${Math.round(
      kf.offset * 100
    )}%</strong>`;
    editor.appendChild(title);

    // offset input
    const offsRow = document.createElement("div");
    offsRow.className = "form-row";
    offsRow.innerHTML = `<label style="min-width:80px">Offset</label>`;
    const offsInput = document.createElement("input");
    offsInput.type = "number";
    offsInput.step = "0.01";
    offsInput.min = "0";
    offsInput.max = "1";
    offsInput.value = kf.offset;
    offsInput.addEventListener("change", () => {
      kf.offset = Number(Math.min(1, Math.max(0, Number(offsInput.value))));
      this.tracks[trackId].keyframes.sort((a, b) => a.offset - b.offset);
      this._renderTracks();
      this._recreateAnimationsDebounced();
      this._openKeyframeEditor(
        trackId,
        this.tracks[trackId].keyframes.indexOf(kf)
      );
    });
    offsRow.appendChild(offsInput);
    editor.appendChild(offsRow);

    // properties list
    for (const [prop, val] of Object.entries(kf)) {
      if (prop === "offset") continue;
      const row = document.createElement("div");
      row.className = "form-row";
      row.innerHTML = `<label style="min-width:80px">${prop}</label>`;
      const valInput = document.createElement("input");
      valInput.value = val;
      valInput.addEventListener("change", () => {
        kf[prop] = valInput.value;
        this._recreateAnimationsDebounced();
      });
      const del = document.createElement("button");
      del.className = "btn ghost";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        delete kf[prop];
        this._openKeyframeEditor(trackId, idx);
        this._recreateAnimationsDebounced();
      });
      row.appendChild(valInput);
      row.appendChild(del);
      editor.appendChild(row);
    }

    // add property form
    const addRow = document.createElement("div");
    addRow.className = "form-row";
    const propInput = document.createElement("input");
    propInput.placeholder = "property";
    const valInput2 = document.createElement("input");
    valInput2.placeholder = "value";
    const addBtn = document.createElement("button");
    addBtn.className = "btn";
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => {
      const p = propInput.value.trim();
      const v = valInput2.value.trim();
      if (!p || !v) return alert("enter property & value");
      kf[p] = v;
      this._openKeyframeEditor(trackId, idx);
      this._recreateAnimationsDebounced();
    });
    addRow.appendChild(propInput);
    addRow.appendChild(valInput2);
    addRow.appendChild(addBtn);
    editor.appendChild(addRow);

    // delete keyframe
    const delKF = document.createElement("div");
    delKF.className = "row";
    delKF.style.marginTop = "8px";
    const delBtn = document.createElement("button");
    delBtn.className = "btn ghost";
    delBtn.textContent = "Delete Keyframe";
    delBtn.addEventListener("click", () => {
      if (!confirm("Delete this keyframe?")) return;
      this.tracks[trackId].keyframes.splice(idx, 1);
      this._renderTracks();
      this._recreateAnimationsDebounced();
      editor.innerHTML = '<div class="muted">Keyframe deleted</div>';
    });
    delKF.appendChild(delBtn);
    editor.appendChild(delKF);
  }

  /* ---------- Add keyframe from stage controls ---------- */
  _onAddKeyframe() {
    const trackId = this.dom.targetSelect.value;
    const prop = this.dom.propInput.value || "transform";
    const val =
      this.dom.valInput.value || (prop === "opacity" ? "0" : "translateX(0px)");
    let offset = Number(this.dom.offsetInput.value);
    if (isNaN(offset)) offset = 0;
    offset = Math.max(0, Math.min(1, offset));
    offset = this._snap(offset);
    const kf = { offset: Number(offset.toFixed(3)) };
    kf[prop] = val;
    this.tracks[trackId].keyframes.push(kf);
    this.tracks[trackId].keyframes.sort((a, b) => a.offset - b.offset);
    this._renderTracks();
    this._recreateAnimationsDebounced();
  }

  /* ---------- playback & WA API ---------- */
  _collectKeyframesFor(name) {
    const list = this.tracks[name].keyframes
      .slice()
      .sort((a, b) => a.offset - b.offset);
    // merge into WA-friendly frames: convert offsets and keep properties
    return list.map((k) => {
      const obj = Object.assign({}, k);
      // ensure offset property in numeric 0..1
      obj.offset = Number(k.offset);
      return obj;
    });
  }

  _recreateAnimations() {
    // cancel existing
    Object.values(this.animations).forEach((a) => {
      try {
        a.cancel();
      } catch (e) {}
    });
    this.animations = {};
    // create animations for each track (unless muted/soloed)
    for (const name of Object.keys(this.tracks)) {
      if (this.solo && this.solo !== name) continue;
      if (this.muted[name]) continue;
      const kfs = this._collectKeyframesFor(name);
      if (kfs.length === 0) continue;
      const element = document.querySelector(`.sample.${name}`);
      if (!element) continue;
      const easing =
        this.dom.easingSelect.value === "custom"
          ? `cubic-bezier(${this.bezier.x1},${this.bezier.y1},${this.bezier.x2},${this.bezier.y2})`
          : this.dom.easingSelect.value;
      const opts = {
        duration: Number(this.dom.duration.value) || 1000,
        easing,
        iterations: Number(this.dom.iterations.value) || 1,
        direction: this.dom.direction.value,
        fill: this.dom.fill.value,
      };
      try {
        const anim = element.animate(kfs, opts);
        anim.pause();
        anim.currentTime = 0;
        this.animations[name] = anim;
      } catch (err) {
        console.warn("Failed to create animation for", name, err);
      }
    }
  }

  _recreateAnimationsDebounced() {
    clearTimeout(this._recreateTimer);
    this._recreateTimer = setTimeout(() => this._recreateAnimations(), 80);
  }

  playAll() {
    this._recreateAnimations();
    const rate = this.options.playbackRate || 1;
    Object.values(this.animations).forEach((anim) => {
      try {
        anim.playbackRate = rate;
        anim.play();
      } catch (e) {}
    });
  }

  pauseAll() {
    Object.values(this.animations).forEach((anim) => {
      try {
        anim.pause();
      } catch (e) {}
    });
  }

  restartAll() {
    Object.values(this.animations).forEach((anim) => {
      try {
        anim.cancel();
      } catch (e) {}
    });
    this._recreateAnimations();
    this.playAll();
  }

  /* ---------- Easing drawing & interactive editor ---------- */
  _drawEasing() {
    const can = this.dom.easingCanvas;
    const ctx = this.ctx;
    const w = can.width,
      h = can.height;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 4) * w, 0);
      ctx.lineTo((i / 4) * w, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i / 4) * h);
      ctx.lineTo(w, (i / 4) * h);
      ctx.stroke();
    }

    // draw curve
    const bez = (t, b) => {
      // cubic bezier using param t and control b = [x1,y1,x2,y2]
      const [x1, y1, x2, y2] = b;
      const cx = 3 * x1,
        bx = 3 * (x2 - x1) - cx,
        ax = 1 - cx - bx;
      const cy = 3 * y1,
        by = 3 * (y2 - y1) - cy,
        ay = 1 - cy - by;
      const x = ((ax * t + bx) * t + cx) * t;
      const y = ((ay * t + by) * t + cy) * t;
      return { x, y };
    };

    const b = [this.bezier.x1, this.bezier.y1, this.bezier.x2, this.bezier.y2];
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(124,92,255,0.98)";
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const p = bez(t, b);
      const px = 10 + p.x * (w - 20);
      const py = h - 10 - p.y * (h - 20);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // draw control points (if custom)
    if (this.dom.easingSelect.value === "custom") {
      const p1x = 10 + this.bezier.x1 * (w - 20);
      const p1y = h - 10 - this.bezier.y1 * (h - 20);
      const p2x = 10 + this.bezier.x2 * (w - 20);
      const p2y = h - 10 - this.bezier.y2 * (h - 20);
      // lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, h - 10);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(w - 10, 10);
      ctx.stroke();
      // points
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p1x, p1y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#f39c12";
      ctx.beginPath();
      ctx.arc(p1x, p1y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p2x, p2y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#f39c12";
      ctx.beginPath();
      ctx.arc(p2x, p2y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    // update cubic input visual
    if (this.dom.cubicInput) {
      this.dom.cubicInput.value = `${Number(
        this.bezier.x1.toFixed(3)
      )},${Number(this.bezier.y1.toFixed(3))},${Number(
        this.bezier.x2.toFixed(3)
      )},${Number(this.bezier.y2.toFixed(3))}`;
    }
  }

  _onEasingPointerDown(ev) {
    const rect = this.dom.easingCanvas.getBoundingClientRect();
    const w = this.dom.easingCanvas.width,
      h = this.dom.easingCanvas.height;
    const localX = ev.clientX - rect.left,
      localY = ev.clientY - rect.top;
    // compute positions of control points
    const px1 = 10 + this.bezier.x1 * (w - 20),
      py1 = h - 10 - this.bezier.y1 * (h - 20);
    const px2 = 10 + this.bezier.x2 * (w - 20),
      py2 = h - 10 - this.bezier.y2 * (h - 20);
    const d1 = Math.hypot(localX - px1, localY - py1),
      d2 = Math.hypot(localX - px2, localY - py2);
    if (d1 < 12) this.draggingCtrl = "p1";
    else if (d2 < 12) this.draggingCtrl = "p2";
  }

  _onEasingPointerMove(ev) {
    if (!this.draggingCtrl) return;
    const rect = this.dom.easingCanvas.getBoundingClientRect();
    const w = this.dom.easingCanvas.width,
      h = this.dom.easingCanvas.height;
    const localX = ev.clientX - rect.left,
      localY = ev.clientY - rect.top;
    const nx = Math.max(0, Math.min(1, (localX - 10) / (w - 20)));
    const ny = Math.max(0, Math.min(1, (h - 10 - localY) / (h - 20)));
    if (this.draggingCtrl === "p1") {
      this.bezier.x1 = Number(nx.toFixed(3));
      this.bezier.y1 = Number(ny.toFixed(3));
    } else {
      this.bezier.x2 = Number(nx.toFixed(3));
      this.bezier.y2 = Number(ny.toFixed(3));
    }
    this.dom.easingSelect.value = "custom";
    this._drawEasing();
    this._recreateAnimationsDebounced();
  }

  _onEasingPointerUp() {
    this.draggingCtrl = null;
  }

  _playEasingPreview() {
    // animate small dot along current cubic bezier
    const canvas = this.dom.easingCanvas;
    const ctx = this.ctx;
    let start = null;
    const w = canvas.width,
      h = canvas.height;
    const b = [this.bezier.x1, this.bezier.y1, this.bezier.x2, this.bezier.y2];
    const bezier = (t) => {
      const [x1, y1, x2, y2] = b;
      const cx = 3 * x1,
        bx = 3 * (x2 - x1) - cx,
        ax = 1 - cx - bx;
      const cy = 3 * y1,
        by = 3 * (y2 - y1) - cy,
        ay = 1 - cy - by;
      const x = ((ax * t + bx) * t + cx) * t;
      const y = ((ay * t + by) * t + cy) * t;
      return { x, y };
    };

    const step = (ts) => {
      if (!start) start = ts;
      const elapsed = (ts - start) % 1000;
      const u = elapsed / 1000;
      this._drawEasing();
      const p = bezier(u);
      const px = 10 + p.x * (w - 20);
      const py = h - 10 - p.y * (h - 20);
      ctx.beginPath();
      ctx.fillStyle = "#ff6b6b";
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      this._easeRAF = requestAnimationFrame(step);
    };
    if (this._easeRAF) cancelAnimationFrame(this._easeRAF);
    this._easeRAF = requestAnimationFrame(step);
    // stop after 2s
    setTimeout(() => {
      cancelAnimationFrame(this._easeRAF);
      this._drawEasing();
    }, 2000);
  }

  /* ---------- Export helpers ---------- */
  exportCSS() {
    let out = "";
    for (const [name, track] of Object.entries(this.tracks)) {
      if (!track.keyframes || track.keyframes.length === 0) continue;
      const animName = `anim_${name}`;
      out += `@keyframes ${animName} {\n`;
      track.keyframes
        .slice()
        .sort((a, b) => a.offset - b.offset)
        .forEach((k) => {
          const pct = Math.round(k.offset * 100);
          out += `  ${pct}% {\n`;
          for (const [p, v] of Object.entries(k)) {
            if (p === "offset") continue;
            const prop = p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
            out += `    ${prop}: ${v};\n`;
          }
          out += `  }\n`;
        });
      out += `}\n\n`;
      out += `.${name}-animated { animation: ${animName} ${
        this.options.duration
      }ms ${
        this.dom.easingSelect.value === "custom"
          ? `cubic-bezier(${this.bezier.x1},${this.bezier.y1},${this.bezier.x2},${this.bezier.y2})`
          : this.dom.easingSelect.value
      } ${this.options.iterations} ${this.options.direction} ${
        this.options.fill
      }; }\n\n`;
    }
    return out || "/* No keyframes to export */";
  }

  exportJS() {
    let out = "";
    for (const [name, track] of Object.entries(this.tracks)) {
      if (!track.keyframes || track.keyframes.length === 0) continue;
      const kfs = JSON.stringify(
        track.keyframes.slice().sort((a, b) => a.offset - b.offset),
        null,
        2
      );
      const easing =
        this.dom.easingSelect.value === "custom"
          ? `cubic-bezier(${this.bezier.x1},${this.bezier.y1},${this.bezier.x2},${this.bezier.y2})`
          : this.dom.easingSelect.value;
      const opts = JSON.stringify(
        {
          duration: this.dom.duration.value,
          easing,
          iterations: this.dom.iterations.value,
          direction: this.dom.direction.value,
          fill: this.dom.fill.value,
        },
        null,
        2
      );
      out += `const el_${name} = document.querySelector('.${name}');\n`;
      out += `const kf_${name} = ${kfs};\n`;
      out += `const opts_${name} = ${opts};\n`;
      out += `el_${name}.animate(kf_${name}, opts_${name});\n\n`;
    }
    return out || "// No keyframes to export";
  }
}

/* ---------- Instantiate & wire small UI bits ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const seq = new Sequencer();

  // expose small helpers for top-level buttons that were not captured earlier
  document
    .getElementById("playAll")
    .addEventListener("click", () => seq.playAll());
  document
    .getElementById("pauseAll")
    .addEventListener("click", () => seq.pauseAll());
  document
    .getElementById("restartAll")
    .addEventListener("click", () => seq.restartAll());
  document
    .getElementById("exportCSS")
    .addEventListener(
      "click",
      () =>
        (document.getElementById("generatedCode").textContent = seq.exportCSS())
    );
  document
    .getElementById("exportJS")
    .addEventListener(
      "click",
      () =>
        (document.getElementById("generatedCode").textContent = seq.exportJS())
    );

  // small convenience: clicking a sample selects that target in the form
  document.querySelectorAll(".sample").forEach((s) => {
    s.addEventListener("click", () => {
      const name = s.dataset.name;
      document.getElementById("targetSelect").value = name;
      seq.dom.targetSelect.value = name;
    });
  });

  // wire add kf form to internal function
  document.getElementById("addKF").addEventListener("click", () => {
    // copy current inputs to seq.dom fields (safety)
    seq.dom.propInput.value = document.getElementById("propInput").value;
    seq.dom.valInput.value = document.getElementById("valInput").value;
    seq.dom.offsetInput.value = document.getElementById("offsetInput").value;
    seq.dom.targetSelect.value = document.getElementById("targetSelect").value;
    seq._onAddKeyframe();
  });

  // ensure timeline initial render
  seq._renderTracks();
});
