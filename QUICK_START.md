# 🎮 Covenant AI Enemies - Quick Start (2 minutes)

## What Just Happened?

You now have a **complete enemy AI system** for your Halo FPS game!

✅ Grunt & Elite enemies with state machine AI
✅ Combat, flanking, grenades, melee attacks
✅ Wave-based spawning system
✅ Difficulty scaling (Tutorial → Legendary)
✅ Full integration with existing game

## Files Added/Updated

```
fps-game/
├── enemies.js               ← Enemy classes (Grunt/Elite)
├── ai-behaviors.js          ← AI perception & tactics
├── enemy-spawner.js         ← Wave management
├── game.js                  ← UPDATED with integration
├── index.html               ← UPDATED with script refs
├── COVENANT_AI_IMPLEMENTATION.md    ← Overview (START HERE)
├── ENEMY_SYSTEM.md                  ← Full documentation
├── ASSET_GUIDE.md                   ← How to get 3D models
└── QUICK_START.md           ← This file
```

## To Run (30 seconds)

```bash
# Option 1: Python HTTP server
cd fps-game
python -m http.server 8000
# Open http://localhost:8000

# Option 2: Use any HTTP server
# (Node, PHP, Ruby, etc.)
```

**Enemies spawn automatically after 1 second!**

## To Get 3D Models (5 minutes)

### Easiest: Free from Sketchfab

```bash
mkdir -p assets/enemies

# Download these files:
# Elite: https://sketchfab.com/3d-models/enemieshalo-4covenantelites-3072f3df595349e29a98621182245231
# Grunt: https://sketchfab.com/3d-models/enemieshalo-4covenantgrunts-824b06222765476a8775675e22709289

# Save as:
# assets/enemies/elite_1.glb
# assets/enemies/grunt_1.glb
```

See `ASSET_GUIDE.md` for detailed steps (+ AI generation option).

## What Enemies Do

### PATROL
- Wander randomly
- Look around (head rotation)
- Low alertness

### ALERT  
- Search for player
- Move to last known position
- Medium alertness

### COMBAT
- Chase and attack
- **Close (<5 units):** Melee attack
- **Medium (5-15 units):** Strafe & shoot
- **Long (15+ units):** Advance & grenades
- High alertness

## Customize in 30 Seconds

### Change Difficulty
In `game.js`, find:
```javascript
const campaignWaves = EnemySpawner.createCampaignWaves('normal');
```

Change to: `'easy'`, `'hard'`, or `'legendary'`

### Change Enemy Health
In `enemies.js`, find:
```javascript
this.maxHealth = 10;  // Grunts
this.maxHealth = 50;  // Elites
```

Increase/decrease number.

### Change Spawn Points
In `game.js`, find:
```javascript
const spawnPoints = [
  new BABYLON.Vector3(50, 2, 50),  // ← Adjust X, Z
  // ... more
];
```

## Controls
- **CLICK:** Fire at enemies
- **R:** Reload
- **1/2:** Switch weapons
- **G:** Throw grenade
- **Space:** Jump
- **WASD:** Move

## What's Next?

1. **Play the game!** Kill some Covenant
2. **Read COVENANT_AI_IMPLEMENTATION.md** for full overview
3. **See ASSET_GUIDE.md** for AI-generated models
4. **Check ENEMY_SYSTEM.md** for advanced customization

## File Structure

```
Required for enemies to work:
✓ enemies.js (class definitions)
✓ ai-behaviors.js (AI logic)
✓ enemy-spawner.js (waves)
✓ game.js (integration)
✓ index.html (script refs)

Optional (for models):
assets/enemies/
├── grunt_1.glb
├── grunt_2.glb
├── grunt_3.glb
├── elite_1.glb
├── elite_2.glb
└── elite_3.glb
```

If no models exist → game uses colored geometric shapes (still fully functional!).

## If Something's Wrong

**Models not loading?**
- Enemies will appear as green/red boxes
- Still fully playable!
- Download assets from ASSET_GUIDE.md

**No enemies spawning?**
- Check browser console (F12)
- Verify spawn points match your level terrain height
- See ENEMY_SYSTEM.md troubleshooting section

**Game too easy/hard?**
- Adjust difficulty preset (see above)
- Edit enemy health/damage in enemies.js

## Key Documentation

| File | Read When |
|------|-----------|
| `QUICK_START.md` | You want to start NOW (this file!) |
| `COVENANT_AI_IMPLEMENTATION.md` | You want overview of what was implemented |
| `ENEMY_SYSTEM.md` | You want technical deep-dive or advanced features |
| `ASSET_GUIDE.md` | You want better 3D models (free or AI) |

---

## Key Features at a Glance

| Feature | Grunt | Elite |
|---------|-------|-------|
| Health | 10 HP | 50 HP + 25 Shield |
| Speed | 12 u/s (fast) | 8 u/s (slow) |
| Melee | 8 DMG | 25 DMG |
| Gun | 10 DMG (65% acc) | 15 DMG (85% acc) |
| Grenades | 1 | 2 |
| Tactics | Aggressive charge | Flanking, cover |

---

## Really Quick TL;DR

1. Run game → `python -m http.server 8000`
2. Optional: Download 3D models from Sketchfab
3. Watch enemies spawn → start shooting
4. Enemies patrol, hunt, and fight back
5. Complete waves → get harder
6. Read docs if you want to customize

**That's it. You're good to go!** 🎮

---

*For full info, see COVENANT_AI_IMPLEMENTATION.md*
