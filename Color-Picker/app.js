class AdvancedColorPicker {
  constructor() {
    this.currentColor = { h: 0, s: 100, l: 50 };
    this.palette = [];
    this.initializeElements();
    this.attachEventListeners();
    this.updateAll();
  }

  initializeElements() {
    this.colorWheel = document.getElementById("colorWheel");
    this.wheelPointer = document.getElementById("wheelPointer");
    this.colorPreview = document.getElementById("colorPreview");
    this.rgbR = document.getElementById("rgbR");
    this.rgbG = document.getElementById("rgbG");
    this.rgbB = document.getElementById("rgbB");
    this.hueSlider = document.getElementById("hueSlider");
    this.satSlider = document.getElementById("satSlider");
    this.lightSlider = document.getElementById("lightSlider");
    this.hexInput = document.getElementById("hexInput");
    this.paletteGrid = document.getElementById("paletteGrid");
    this.eyedropperBtn = document.getElementById("eyedropperBtn");
    this.eyedropperNote = document.getElementById("eyedropperNote");

    // Check EyeDropper API support
    this.checkEyeDropperSupport();
  }

  attachEventListeners() {
    // Color wheel interaction
    this.colorWheel.addEventListener("mousedown", (e) =>
      this.startWheelDrag(e)
    );
    this.colorWheel.addEventListener("click", (e) => this.handleWheelClick(e));

    // Sliders
    this.hueSlider.addEventListener("input", (e) =>
      this.updateFromHue(e.target.value)
    );
    this.satSlider.addEventListener("input", (e) =>
      this.updateFromSaturation(e.target.value)
    );
    this.lightSlider.addEventListener("input", (e) =>
      this.updateFromLightness(e.target.value)
    );

    // RGB inputs
    [this.rgbR, this.rgbG, this.rgbB].forEach((input) => {
      input.addEventListener("input", () => this.updateFromRGB());
    });

    // Hex input
    this.hexInput.addEventListener("input", (e) =>
      this.updateFromHex(e.target.value)
    );

    // Palette controls
    document
      .getElementById("addToPalette")
      .addEventListener("click", () => this.addToPalette());
    document
      .getElementById("clearPalette")
      .addEventListener("click", () => this.clearPalette());
    document
      .getElementById("generatePalette")
      .addEventListener("click", () => this.generateHarmony());

    // Eyedropper
    if (this.eyedropperBtn) {
      this.eyedropperBtn.addEventListener("click", () =>
        this.activateEyeDropper()
      );
    }
  }

  checkEyeDropperSupport() {
    if (!window.EyeDropper) {
      if (this.eyedropperBtn) {
        this.eyedropperBtn.disabled = true;
        this.eyedropperBtn.innerHTML =
          '<span class="eyedropper-icon">❌</span>Not Supported';
      }
      if (this.eyedropperNote) {
        this.eyedropperNote.textContent =
          "EyeDropper API not supported in this browser. Try Chrome 95+ or Edge 95+";
        this.eyedropperNote.style.color = "#ff6b6b";
      }
    } else {
      this.eyeDropper = new EyeDropper();
    }
  }

  async activateEyeDropper() {
    if (!this.eyeDropper) {
      alert("EyeDropper API not supported in this browser");
      return;
    }

    try {
      // Change button state
      this.eyedropperBtn.innerHTML =
        '<span class="eyedropper-icon">⏳</span>Click to sample...';
      this.eyedropperBtn.disabled = true;
      this.eyedropperNote.textContent =
        "Click anywhere on your screen to sample a color";
      this.eyedropperNote.style.color = "#667eea";

      // Open the eyedropper
      const result = await this.eyeDropper.open();

      // Update color from sampled result
      this.updateFromHex(result.sRGBHex);

      // Show success feedback
      this.eyedropperNote.textContent = `Sampled color: ${result.sRGBHex}`;
      this.eyedropperNote.style.color = "#28a745";

      setTimeout(() => {
        this.eyedropperNote.textContent =
          "Click to sample any color from your screen";
        this.eyedropperNote.style.color = "#666";
      }, 3000);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("EyeDropper error:", error);
        this.eyedropperNote.textContent = "Error using eyedropper tool";
        this.eyedropperNote.style.color = "#ff6b6b";
      } else {
        this.eyedropperNote.textContent = "Color sampling cancelled";
        this.eyedropperNote.style.color = "#666";
      }
    } finally {
      // Reset button state
      this.eyedropperBtn.innerHTML =
        '<span class="eyedropper-icon">🎯</span>Pick from Screen';
      this.eyedropperBtn.disabled = false;
    }
  }

  startWheelDrag(e) {
    const handleMouseMove = (e) => this.handleWheelClick(e);
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    this.handleWheelClick(e);
  }

  handleWheelClick(e) {
    const rect = this.colorWheel.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    const angle = Math.atan2(y, x);
    const distance = Math.min(Math.sqrt(x * x + y * y), centerX);

    const hue = ((angle * 180) / Math.PI + 360) % 360;
    const saturation = Math.min((distance / centerX) * 100, 100);

    this.currentColor.h = hue;
    this.currentColor.s = saturation;

    this.updateAll();
  }

  updateFromHue(value) {
    this.currentColor.h = parseFloat(value);
    this.updateAll();
  }

  updateFromSaturation(value) {
    this.currentColor.s = parseFloat(value);
    this.updateAll();
  }

  updateFromLightness(value) {
    this.currentColor.l = parseFloat(value);
    this.updateAll();
  }

  updateFromRGB() {
    const r = parseInt(this.rgbR.value) || 0;
    const g = parseInt(this.rgbG.value) || 0;
    const b = parseInt(this.rgbB.value) || 0;

    const hsl = this.rgbToHsl(r, g, b);
    this.currentColor = { h: hsl.h, s: hsl.s, l: hsl.l };
    this.updateAll();
  }

  updateFromHex(hex) {
    if (!hex || hex.length !== 7 || hex.charAt(0) !== "#") return;
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);

    const hsl = this.rgbToHsl(r, g, b);
    this.currentColor = { h: hsl.h, s: hsl.s, l: hsl.l };
    this.updateAll();
  }

  updateAll() {
    this.updateColorPreview();
    this.updateSliders();
    this.updateRGBInputs();
    this.updateHexInput();
    this.updateWheelPointer();
    this.updateSliderBackgrounds();
    this.updateExportFormats();
  }

  updateColorPreview() {
    const color = `hsl(${this.currentColor.h}, ${this.currentColor.s}%, ${this.currentColor.l}%)`;
    this.colorPreview.style.background = color;
  }

  updateSliders() {
    this.hueSlider.value = this.currentColor.h;
    this.satSlider.value = this.currentColor.s;
    this.lightSlider.value = this.currentColor.l;

    document.getElementById("hueValue").textContent = Math.round(
      this.currentColor.h
    );
    document.getElementById("satValue").textContent = Math.round(
      this.currentColor.s
    );
    document.getElementById("lightValue").textContent = Math.round(
      this.currentColor.l
    );
  }

  updateRGBInputs() {
    const rgb = this.hslToRgb(
      this.currentColor.h,
      this.currentColor.s,
      this.currentColor.l
    );
    this.rgbR.value = rgb.r;
    this.rgbG.value = rgb.g;
    this.rgbB.value = rgb.b;
  }

  updateHexInput() {
    const rgb = this.hslToRgb(
      this.currentColor.h,
      this.currentColor.s,
      this.currentColor.l
    );
    const hex =
      "#" +
      [rgb.r, rgb.g, rgb.b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("");
    this.hexInput.value = hex.toUpperCase();
  }

  updateWheelPointer() {
    const rect = this.colorWheel.getBoundingClientRect();
    const radius = rect.width / 2;
    const angle = (this.currentColor.h * Math.PI) / 180;
    const distance = (this.currentColor.s / 100) * (radius - 8); // Adjust for border and pointer size

    const x = Math.cos(angle) * distance + radius;
    const y = Math.sin(angle) * distance + radius;

    // Position pointer (assumes wheel container is positioned so left/top 0 aligns)
    this.wheelPointer.style.left = `${x}px`;
    this.wheelPointer.style.top = `${y}px`;

    // ✅ Make pointer match the exact current color (with H, S, L)
    this.wheelPointer.style.backgroundColor = `hsl(${this.currentColor.h}, ${this.currentColor.s}%, ${this.currentColor.l}%)`;
  }

  updateSliderBackgrounds() {
    const satSliderEl = document.querySelector(".saturation-slider");
    const lightSliderEl = document.querySelector(".lightness-slider");

    if (satSliderEl) {
      satSliderEl.style.background = `linear-gradient(to right, hsl(${this.currentColor.h}, 0%, ${this.currentColor.l}%), hsl(${this.currentColor.h}, 100%, ${this.currentColor.l}%))`;
    }

    if (lightSliderEl) {
      lightSliderEl.style.background = `linear-gradient(to right, hsl(${this.currentColor.h}, ${this.currentColor.s}%, 0%), hsl(${this.currentColor.h}, ${this.currentColor.s}%, 50%), hsl(${this.currentColor.h}, ${this.currentColor.s}%, 100%))`;
    }
  }

  updateExportFormats() {
    const rgb = this.hslToRgb(
      this.currentColor.h,
      this.currentColor.s,
      this.currentColor.l
    );
    const hex = this.hexInput.value;

    const cssOutput = document.getElementById("cssOutput");
    const rgbOutput = document.getElementById("rgbOutput");
    const hslOutput = document.getElementById("hslOutput");
    const jsonOutput = document.getElementById("jsonOutput");

    if (cssOutput) cssOutput.textContent = `color: ${hex.toLowerCase()};`;
    if (rgbOutput) rgbOutput.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    if (hslOutput)
      hslOutput.textContent = `hsl(${Math.round(
        this.currentColor.h
      )}, ${Math.round(this.currentColor.s)}%, ${Math.round(
        this.currentColor.l
      )}%)`;
    if (jsonOutput)
      jsonOutput.textContent = JSON.stringify(
        {
          colors: this.palette.map((color) => ({
            hex: color.hex,
            rgb: color.rgb,
            hsl: color.hsl,
          })),
        },
        null,
        2
      );
  }

  addToPalette() {
    const rgb = this.hslToRgb(
      this.currentColor.h,
      this.currentColor.s,
      this.currentColor.l
    );
    const hex = this.hexInput.value;
    const hsl = `hsl(${Math.round(this.currentColor.h)}, ${Math.round(
      this.currentColor.s
    )}%, ${Math.round(this.currentColor.l)}%)`;

    const color = {
      hex: hex,
      rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hsl: hsl,
      id: Date.now(),
    };

    this.palette.push(color);
    this.renderPalette();
    this.updateExportFormats();
  }

  clearPalette() {
    this.palette = [];
    this.renderPalette();
    this.updateExportFormats();
  }

  generateHarmony() {
    this.palette = [];
    const baseHue = this.currentColor.h;

    // Generate complementary, triadic, and analogous colors
    const harmonies = [
      { h: baseHue, s: this.currentColor.s, l: this.currentColor.l },
      {
        h: (baseHue + 180) % 360,
        s: this.currentColor.s,
        l: this.currentColor.l,
      },
      {
        h: (baseHue + 120) % 360,
        s: this.currentColor.s,
        l: this.currentColor.l,
      },
      {
        h: (baseHue + 240) % 360,
        s: this.currentColor.s,
        l: this.currentColor.l,
      },
      {
        h: (baseHue + 30) % 360,
        s: this.currentColor.s,
        l: this.currentColor.l,
      },
      {
        h: (baseHue - 30 + 360) % 360,
        s: this.currentColor.s,
        l: this.currentColor.l,
      },
    ];

    harmonies.forEach((color) => {
      const rgb = this.hslToRgb(color.h, color.s, color.l);
      const hex =
        "#" +
        [rgb.r, rgb.g, rgb.b]
          .map((x) => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
          })
          .join("");

      this.palette.push({
        hex: hex.toUpperCase(),
        rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        hsl: `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(
          color.l
        )}%)`,
        id: Date.now() + Math.random(),
      });
    });

    this.renderPalette();
    this.updateExportFormats();
  }

  renderPalette() {
    this.paletteGrid.innerHTML = "";

    this.palette.forEach((color) => {
      const colorEl = document.createElement("div");
      colorEl.className = "palette-color";
      colorEl.style.backgroundColor = color.hex;
      colorEl.innerHTML = `
                ${color.hex}
                <button class="delete-color" onclick="colorPicker.removeFromPalette('${color.id}')">×</button>
            `;

      colorEl.addEventListener("click", (e) => {
        if (!e.target.classList.contains("delete-color")) {
          this.updateFromHex(color.hex);
        }
      });

      this.paletteGrid.appendChild(colorEl);
    });
  }

  removeFromPalette(id) {
    this.palette = this.palette.filter((color) => color.id != id);
    this.renderPalette();
    this.updateExportFormats();
  }

  // Utility functions
  hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }
}

// Initialize the color picker
const colorPicker = new AdvancedColorPicker();

// Add click-to-copy functionality for export formats
document.querySelectorAll(".format-card code").forEach((codeEl) => {
  codeEl.style.cursor = "pointer";
  codeEl.title = "Click to copy";

  codeEl.addEventListener("click", () => {
    navigator.clipboard
      .writeText(codeEl.textContent)
      .then(() => {
        const originalBg = codeEl.style.backgroundColor;
        codeEl.style.backgroundColor = "#d4edda";
        codeEl.style.transition = "background-color 0.3s ease";

        setTimeout(() => {
          codeEl.style.backgroundColor = originalBg;
        }, 1000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  });
});

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case "s":
        e.preventDefault();
        // Save palette as JSON
        const dataStr = JSON.stringify(
          {
            currentColor: colorPicker.currentColor,
            palette: colorPicker.palette,
          },
          null,
          2
        );
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "color-palette.json";
        link.click();
        URL.revokeObjectURL(url);
        break;

      case "c":
        if (e.target.tagName !== "INPUT") {
          e.preventDefault();
          colorPicker.addToPalette();
        }
        break;

      case "r":
        e.preventDefault();
        colorPicker.generateHarmony();
        break;
    }
  }
});

// Add file import functionality
const importInput = document.createElement("input");
importInput.type = "file";
importInput.accept = ".json";
importInput.style.display = "none";
document.body.appendChild(importInput);

importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.currentColor) {
          colorPicker.currentColor = data.currentColor;
        }
        if (data.palette) {
          colorPicker.palette = data.palette;
        }
        colorPicker.updateAll();
        colorPicker.renderPalette();
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }
});

// Add import button
const importBtn = document.createElement("button");
importBtn.className = "btn btn-secondary";
importBtn.textContent = "Import Palette";
importBtn.addEventListener("click", () => importInput.click());
const paletteControlsEl = document.querySelector(".palette-controls");
if (paletteControlsEl) paletteControlsEl.appendChild(importBtn);

// Add export CSS button
const exportCssBtn = document.createElement("button");
exportCssBtn.className = "btn btn-primary";
exportCssBtn.textContent = "Export CSS";
exportCssBtn.addEventListener("click", () => {
  const cssContent = `:root {
${colorPicker.palette
  .map((color, index) => `  --color-${index + 1}: ${color.hex};`)
  .join("\n")}
}

/* Color classes */
${colorPicker.palette
  .map(
    (color, index) =>
      `.color-${index + 1} { color: ${color.hex}; }\n.bg-color-${
        index + 1
      } { background-color: ${color.hex}; }`
  )
  .join("\n")}`;

  const blob = new Blob([cssContent], { type: "text/css" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "color-palette.css";
  link.click();
  URL.revokeObjectURL(url);
});
if (paletteControlsEl) paletteControlsEl.appendChild(exportCssBtn);

// Add random color generator
const randomBtn = document.createElement("button");
randomBtn.className = "btn btn-secondary";
randomBtn.textContent = "Random Color";
randomBtn.addEventListener("click", () => {
  colorPicker.currentColor = {
    h: Math.random() * 360,
    s: 50 + Math.random() * 50,
    l: 30 + Math.random() * 40,
  };
  colorPicker.updateAll();
});
const controlsPanelEl = document.querySelector(".controls-panel");
if (controlsPanelEl) controlsPanelEl.appendChild(randomBtn);
class ColorPicker {
  constructor(wheelElement, pointerElement, sliderElement, previewElement) {
    this.colorWheel = wheelElement;
    this.wheelPointer = pointerElement;
    this.lightnessSlider = sliderElement;
    this.preview = previewElement;

    this.currentColor = { h: 0, s: 100, l: 50 };

    // Bind handlers
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    // Setup
    this.initEvents();
    this.updateWheelPointer();
    this.updatePreview();
  }

  initEvents() {
    // Use pointer events for both mouse & touch
    this.colorWheel.addEventListener("pointerdown", (e) =>
      this.onPointerDown(e)
    );
    this.lightnessSlider.addEventListener("input", (e) =>
      this.onSliderChange(e)
    );
  }

  getWheelCenterAndRadius() {
    const rect = this.colorWheel.getBoundingClientRect();
    const radius = rect.width / 2;
    const center = { x: rect.left + radius, y: rect.top + radius };
    return { center, radius };
  }

  onPointerDown(e) {
    e.preventDefault();
    this.updateColorFromEvent(e);

    // Listen to movement globally until pointerup
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  onPointerMove(e) {
    this.updateColorFromEvent(e);
  }

  onPointerUp() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }

  updateColorFromEvent(e) {
    const { center, radius } = this.getWheelCenterAndRadius();

    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;

    const angle = Math.atan2(dy, dx);
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), radius);

    const h = (angle * 180) / Math.PI;
    const s = (distance / radius) * 100;

    this.currentColor.h = (h + 360) % 360; // keep in 0–360
    this.currentColor.s = Math.min(100, Math.max(0, s));

    this.updateWheelPointer();
    this.updatePreview();
  }

  onSliderChange(e) {
    this.currentColor.l = e.target.value;
    this.updateWheelPointer();
    this.updatePreview();
  }

  updateWheelPointer() {
    const { center, radius } = this.getWheelCenterAndRadius();
    const angle = (this.currentColor.h * Math.PI) / 180;
    const distance = (this.currentColor.s / 100) * (radius - 8);

    const x =
      Math.cos(angle) * distance +
      center.x -
      this.colorWheel.getBoundingClientRect().left;
    const y =
      Math.sin(angle) * distance +
      center.y -
      this.colorWheel.getBoundingClientRect().top;

    this.wheelPointer.style.left = `${x}px`;
    this.wheelPointer.style.top = `${y}px`;

    // Pointer matches exact current color
    this.wheelPointer.style.backgroundColor = `hsl(${this.currentColor.h}, ${this.currentColor.s}%, ${this.currentColor.l}%)`;
  }

  updatePreview() {
    this.preview.style.backgroundColor = `hsl(${this.currentColor.h}, ${this.currentColor.s}%, ${this.currentColor.l}%)`;
  }
}
