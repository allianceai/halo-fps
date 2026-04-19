# Halo-Inspired Browser FPS

A browser-playable first-person shooter built with Babylon.js.

## How to Run

```bash
cd /home/cameron/fps-game
python3 -m http.server 8080
```

Then open http://localhost:8080 in Chrome or Firefox.

> Safari may have issues with pointer lock — Chrome is recommended.

## Controls

| Key / Input  | Action              |
|--------------|---------------------|
| WASD         | Move                |
| Mouse        | Look around (click canvas to lock) |
| Left Click   | Shoot               |
| R            | Reload              |
| Spacebar     | Jump                |
| Escape       | Release mouse       |

## Features

- Babylon.js 6.x with Havok physics
- FPS camera with gravity, collision, and jump
- 60 × 60 arena with perimeter walls and decorative pillars
- 6 scattered cover boxes with randomised colours
- Shooting raycast with red hit-flash feedback and muzzle flash
- Semi-automatic fire with dry-fire feedback
- Reload system (R key)
- HUD: health bar (colour-shifts green → yellow → red) and ammo counter
- Atmospheric fog and directional shadow casting

## File Structure

```
fps-game/
├── index.html   — page shell, CDN script tags, HUD + overlay markup
├── style.css    — layout, crosshair, HUD, overlay styles
├── game.js      — full Babylon.js game logic
└── README.md    — this file
```
