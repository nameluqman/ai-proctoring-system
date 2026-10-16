# Real-Time AI Proctoring & Candidate Monitoring Platform

A production-grade, real-time assessment and remote proctoring platform built with **Next.js**, **WebRTC**, and **MediaPipe**. Designed for automated candidate monitoring, browser telemetry tracking, and secure evidence capture.

![Tech Stack](https://img.shields.io/badge/Tech-Next.js%20%7C%20TypeScript%20%7C%20WebRTC%20%7C%20MediaPipe-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---
## 📸 Application Screenshots

### 1. Candidate Assessment & AI Monitoring View
> Real-time webcam feed with MediaPipe face/phone detection and telemetry status.

![Candidate View](./candidate.png)

### 2. Live Proctor Dashboard
> Real-time telemetry log, violation metrics, and remote student stream monitoring.

![Proctor Dashboard](./proctor.png)

## 🚀 Key Features

### 1. Computer Vision & Webcam AI (MediaPipe)
* **Phone Detection:** Real-time object tracking to identify unauthorized electronic devices.
* **Face Presence Tracking:** Instant alerts for *No Face* detected or *Multiple Faces* in the webcam frame.
* **Gaze & Head Pose Deviation:** Heuristic tracking of candidate head/gaze movement away from the screen.

### 2. Browser Telemetry & Activity Signals
* **Tab Switching & Unfocus:** Detects visibility changes when candidates switch tabs or click away from the assessment window.
* **Clipboard & Input Monitoring:** Logs copy, paste, and right-click context menu attempts.
* **Display Mismatch Detection:** Monitors viewport constraints (e.g., width < 1024px or split-screen/resizing behavior) with safety buffers.

### 3. Audio & System Monitoring
* **Sustained Audio Anomaly Detection:** Uses the Web Audio API to monitor microphone streams and flag continuous loud noises or speech.
* **Permission-Based Screen Sharing:** Secure PeerJS/WebRTC video and audio streaming for live proctor oversight.

### 4. Live Proctor Dashboard
* **Real-time Telemetry Logger:** Centralized event stream with timestamped violation logs.
* **Automated Evidence Capture:** Automatically captures and stores local screenshot evidence upon critical triggers.
* **Away-Time Tracking:** Tracks duration and frequency of candidate absence.

---

## 🛠️ Tech Stack

* **Frontend & Backend:** Next.js (App Router), React, TypeScript
* **Styling:** Tailwind CSS
* **Real-time Communication:** PeerJS / WebRTC
* **AI / Computer Vision:** MediaPipe (Tasks Vision / FaceLandmarker / ObjectDetector)
* **Audio Processing:** Web Audio API (RMS & frequency analysis)

---

## 📁 Project Structure

```text
proctoring-system-app/
├── app/                  # Next.js App Router (Candidate & Proctor views)
├── components/           # UI components (Webcam, ScreenShare, Dashboard)
├── hooks/                # Custom React hooks (AI detection, WebRTC, Audio monitoring)
├── lib/                  # Evidence storage and helper utilities
├── types/                # TypeScript interfaces and global definitions
└── public/               # Static assets and model binaries

⚙️ Getting Started
Prerequisites
Node.js (v18+ recommended)

npm or yarn

Installation & Setup
Clone the repository:

Bash
git clone [https://github.com/nameluqman/ai-proctoring-system.git](https://github.com/nameluqman/ai-proctoring-system.git)
cd ai-proctoring-system
Install dependencies:

Bash
npm install
Run the development server:

Bash
npm run dev
Open http://localhost:3000 in your browser to view the application. (Note: Camera, microphone, and screen share features require a secure context or localhost setup).

🛡️ Heuristics & Disclaimer
Proctoring telemetry signals act as review heuristics and indicators for human proctors rather than absolute automated legal proof, ensuring balanced oversight and minimal false-penalization.

📄 License
This project is open-source and available under the MIT License.