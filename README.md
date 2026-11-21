# ⚡ Kinetic Blitz

> **A fast-paced, 100% on-device webcam fitness exergame.**  
> Turn any standard laptop or desktop camera into an immersive, pseudo-3D rhythm workout—without requiring VR headsets, wearable sensors, or external depth cameras.

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MediaPipe](https://img.shields.io/badge/Google_MediaPipe-Tasks_Vision-4285F4?logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_On--Device-success)](#-privacy--security)

---

## 🌟 Key Features

### 🥊 Dynamic 3D Combat Movements
- **Pulse Strikes (Approaching Orbs)**: Circular targets emerge from depth along radial vectors and accelerate towards the player. Outer timing rings shrink to indicate the ideal strike plane. Players can strike with speed to trigger high-impact **Power Hits**, and orbs remain hittable until they leave the screen edges.
- **Solar Holds (Isometric Mobility Nodes)**: Drifting golden solar nodes challenge mobility and range of motion. Players reach and hold a hand steadily inside the node to charge it to 100%.
- **Laser Barriers (Full-Body Dodges)**: High-hazard red laser beams telegraph across the screen, prompting players to duck/squat under horizontal barriers or lean laterally away from vertical sweeps.

### 📏 Adaptive Body Calibration & Posture Detection
- **Proportional Scaling**: Automatically calibrates each target's radial trajectory and reach distance relative to your individual shoulder width, arm span, and torso height.
- **Standing & Seated Playability**: Real-time knee/hip angle analysis auto-detects standing vs. seated gameplay, making the game fully accessible for desk workouts or wheelchair users.
- **Smart Fist Tracking**: Replaces simple wrist detection with anatomical knuckle and forearm-vector extrapolation, placing targeting reticles squarely on the knuckles of clenched fists.
- **5-Second Lock-on**: Generous 5-second countdown with 60 FPS multi-sample averaging for stable body calibration.

### 🔒 100% On-Device Privacy & Self-Hosted Assets
- **Zero Server Uploads**: Camera streams never leave your device. All computer vision and pose inference run strictly locally on your GPU via WebGL and WebAssembly.
- **Fully Bundled Model**: Google MediaPipe's `pose_landmarker_lite.task` model binary and WebAssembly runtimes are self-hosted directly within the application bundle (`/public/models` and `/public/wasm`). No external Google Cloud or CDN requests are made at runtime.

### 🎚️ Difficulty Scaling & Calorie Estimation
- **Easy (Casual / Warmup)**: Relaxed approach speed ($2.0\text{s}$ down to $1.35\text{s}$), larger timing rings, lower hazard density, and $5.0\text{ METs}$ metabolic burn rate.
- **Medium (Standard / Active)**: Balanced cardio pace ($1.6\text{s}$ down to $1.05\text{s}$), intermediate spawn rates, and $6.5\text{ METs}$.
- **Hard (Intense / Cardio)**: Rapid-fire strikes ($1.2\text{s}$ down to $0.75\text{s}$), multiple concurrent solar nodes, frequent laser hazards, and $8.5\text{ METs}$.
- **Real-Time MET Formula**:
  $$\text{Calories Burned} = \frac{\text{Time (min)} \times \text{MET} \times 3.5 \times \text{Weight (70 kg)}}{200}$$

### 📺 "Play on TV" Wireless Casting Mode
- **Zero-Backend Peer-to-Peer Streaming**: Phone runs all pose tracking, gameplay physics, and Web Audio locally, streaming rendered visuals and sound directly to an Android TV / Smart TV browser (`/tv`) over local WebRTC.
- **Instant QR & 4-Character Pairing**: Point your phone camera at the TV's QR code or type the 4-character room code to pair in seconds.
- **TV-Optimized Experience**: Fullscreen display with high-contrast HUD overlays (Score, Combo, Countdown, Calories, and Summary), remote-friendly D-pad sound unmuting, and automatic screen wake-lock on phone.

### 📷 Visual & Privacy Display Modes
1. **Webcam Mirror (`dimmed`)**: Live mirrored webcam video with cyber HUD and targeting reticles.
2. **Neon Silhouette (`silhouette`)**: Privacy mode where the video is hidden, rendering a neon wireframe skeleton on a cyber grid.
3. **Cyber Grid (`hidden`)**: Minimalist HUD with camera feed completely hidden; only gameplay targets and fist crosshairs are shown.
*(Choice is stored persistently in `localStorage`).*

### 📊 Lifetime Stats & Workout History
- Stores detailed records of past workout sessions: date, mode, difficulty, total score, rank ($S / A / B / C$), calories burned, and strike/hold/dodge breakdowns.
- Aggregates lifetime totals for workouts completed, total calories burned, highest score, and total hits.

### 🎓 Interactive Onboarding Tutorial
- Guided interactive practice covering strikes, mobility holds, and full-body laser dodges.
- Features automatic repetition if a dodge or strike is missed, ensuring players master the mechanics before starting a workout.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Dev Tooling** | [Vite 6](https://vitejs.dev/) |
| **Styling & Theme** | [Tailwind CSS 3](https://tailwindcss.com/) with Cyberpunk Neon Palette (`#00f3ff`, `#ff007f`, `#ffd700`, `#ff1a40`) |
| **Computer Vision / AI** | [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (PoseLandmarker Lite, WebAssembly & WebGL) |
| **Graphics & Rendering** | HTML5 2D Canvas (60 FPS procedural rendering with screen shake and particle bursts) |
| **Audio Engine** | Web Audio API (procedural real-time synthesis: punch snaps, charge risers, laser sirens, countdown bleeps) |
| **Icons & Effects** | [Lucide React](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) |

---

## 📂 Project Architecture

```
pulseGame/
├── public/
│   ├── models/                  # Self-hosted MediaPipe neural network weights (.task)
│   └── wasm/                    # Self-hosted MediaPipe vision WebAssembly runtime
├── src/
│   ├── audio/
│   │   └── soundEngine.ts       # Procedural Web Audio API sound generator
│   ├── components/
│   │   ├── CalibrationOverlay.tsx # 5-second body lock-on & posture selector
│   │   ├── DevToolbar.tsx       # Development & mock testing toolbar (dev mode only)
│   │   ├── GameHUD.tsx          # Real-time score, multiplier, timer, and controls
│   │   ├── HistoryModal.tsx     # Lifetime statistics & workout logs
│   │   ├── StartScreen.tsx      # Mode, difficulty, posture & camera preferences
│   │   ├── SummaryModal.tsx     # Post-workout breakdown, rank grade & confetti
│   │   └── TutorialOverlay.tsx  # Step-by-step interactive onboarding
│   ├── engine/
│   │   ├── collision.ts         # Fist & posture collision detection algorithms
│   │   ├── gameEngine.ts        # Central state machine & spawn director
│   │   ├── particleSystem.ts    # Punch bursts, floating score text & trails
│   │   └── targetFactory.ts     # Body-proportional procedural target generator
│   ├── renderer/
│   │   └── canvasRenderer.ts    # 60 FPS Canvas rendering layer
│   ├── types/
│   │   └── game.ts              # Game TypeScript interfaces and type definitions
│   ├── utils/
│   │   └── historyManager.ts    # LocalStorage workout persistence
│   ├── vision/
│   │   ├── handTracking.ts      # Knuckle & forearm-vector fist calculation
│   │   ├── mockPoseProvider.ts  # Autonomous bot & simulation provider
│   │   ├── poseService.ts       # MediaPipe PoseLandmarker singleton & object-cover mapping
│   │   └── postureDetector.ts   # Standing vs. seated & presence auto-pause logic
│   ├── App.tsx                  # Main application orchestrator & 60 FPS loop
│   ├── index.css                # Tailwind CSS imports & Orbitron typography
│   └── main.tsx                 # React DOM mount point
├── index.html                   # HTML entry point with Orbitron & Rajdhani fonts
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- A standard built-in or USB webcam

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MasoudViand/kinetic-pulse.git
   cd kinetic-pulse
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:3000/`.

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Preview the production build**:
   ```bash
   npm run preview
   ```

---

## 🎮 How to Play

1. **Step into Frame**: Allow webcam access and stand approximately 4–8 feet back so your head, shoulders, and hands are visible.
2. **Body Calibration**: During the 5-second countdown, steady your posture. The game automatically detects whether you are standing or seated and scales all target spans to your shoulders.
3. **Punch Pulse Orbs**: Watch orbs approach from the depth of the screen. As the outer timing ring contracts onto the target, snap your fist forward. Striking with high speed scores a **Power Hit** bonus!
4. **Hold Solar Nodes**: Move either hand into glowing golden nodes and hold steady until the charge meter fills to 100%.
5. **Dodge Lasers**: When flashing red warning hazard grids appear, squat down low or lean your head and torso laterally to clear the beam before it activates.

---

## 🔒 Privacy & Security

Kinetic Blitz was built from the ground up with a privacy-first architecture:
- **No Video Recording or Streaming**: Video streams from `navigator.mediaDevices.getUserMedia` are fed directly into local WebAssembly memory on your device.
- **Zero Cloud Processing**: No facial recognition, personal identifiers, or coordinate telemetry are collected or transmitted across the network.
- **Self-Hosted Offline Bundle**: Model weights and WASM binaries are stored locally in `/public`, ensuring no external dependencies on third-party CDNs.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
