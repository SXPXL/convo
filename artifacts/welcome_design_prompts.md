# AI Design Prompts for the 5-Gate Welcome Page

You can use these prompts to generate visual mockups or code implementations for your welcome screen.

---

## 1. Prompt for UI / Code Generators (e.g., v0.dev, Claude Artifacts, ChatGPT)

*Copy and paste this prompt if you are using an AI tool to generate code, React components, or HTML/CSS layouts.*

```text
Create a premium, futuristic 5-column live check-in welcome screen dashboard for a college convocation. The dashboard will be shown on a widescreen TV monitor.

Key Layout & Aesthetics:
- Sleek dark theme: Background should be a deep, dark blue/gray (#0b0d10 to #030712) with subtle radial gradients.
- Grid: 5 equal vertical columns, each representing a Gate (Gate 1 to Gate 5).
- Card design: Glassmorphism cards inside the columns with thin, glowing borders (semi-transparent purple/blue/green) and a subtle backdrop blur.
- Header: Minimalist top navigation bar with a pulsing red/green "LIVE SCAN MONITOR" badge.
- Typography: Large, high-end sans-serif font (like Outfit or Inter) with clean letter-spacing.

Gate Column Details:
- Each column header has a gate name ("GATE 1" to "GATE 5") next to a pulsing green dot showing the gate is active.
- Default empty state: A placeholder card showing an elegant pulsing student silhouette or QR-code-like outline with "Waiting for Check-in" text in muted gray.
- Active checked-in state: 
  * A circular student photo at the center with a glowing, pulsing purple border.
  * The student’s name in bold white text (large and readable from a distance).
  * A badge indicating if they are a "STUDENT" (purple badge) or "GUARDIAN" (blue badge).
  * Sub-text displaying the student's Department (e.g., "Computer Science") and Register Number.
  * A prominent, high-contrast seat number block (e.g. "S-0024") styled in a glowing accent color.
  * A micro timestamp at the bottom showing the exact scan time.

Animations & Interactions:
- Card transitions: When a gate updates, the old student details must slide down and fade out, and the new student details must slide down and fade in from the top.
- Confetti: When a student transitions in, a burst of colorful confetti should shoot out from the center of that gate's column.
- Queue counter: If multiple students are scanned at once, display a small floating badge at the bottom of the column saying "+X waiting" or "X in queue".

Please write HTML, Tailwind CSS, and Vanilla JavaScript (or React) to implement the layout, CSS keyframe animations, and mock WebSocket event queue processing where each student is displayed for a minimum of 5 seconds before pulling the next student from that gate's queue.
```

---

## 2. Prompt for Image Generators (e.g., Midjourney, DALL-E 3, Stable Diffusion)

*Copy and paste these prompts if you want to generate high-fidelity visual mockups, UI concepts, or graphic inspiration.*

### Midjourney v6 Prompt
```text
Futuristic dashboard user interface design, 5-column grid layout welcome screen for event registration, dark mode black background with neon violet and emerald green accents, glassmorphic card widgets, high resolution avatar circles with glowing borders, clean modern typography, UI design, vector aesthetic, tech HUD styling, flat design, cinematic lighting, photorealistic screenshot --ar 16:9 --style raw --v 6.0
```

### DALL-E 3 / Bing Image Creator Prompt
```text
A professional widescreen UI dashboard mock-up shown on a wall-mounted display. The UI is designed for a university check-in system, divided into 5 vertical columns labeled Gate 1 to Gate 5. Modern dark mode interface with glass-like translucent panels, subtle purple neon glows, circular user profile photos with glowing rings, bold clean white text, and colorful status badges. Clean, futuristic, premium look, high contrast, 4k resolution screenshot of a digital product.
```
