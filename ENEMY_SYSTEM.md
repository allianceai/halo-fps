# Covenant Enemy AI System - Documentation

## Overview

A complete state-machine-based AI system for Halo-inspired Covenant enemies (Grunts and Elites) with:
- Patrol → Alert → Combat state transitions
- Line-of-sight perception with raycasting
- Tactical decisions (flanking, cover seeking, grenade throws)
- Melee and ranged combat
- Wave-based spawning system
- Difficulty scaling

## Architecture

### Files

| File | Lines | Purpose |
|------|-------|---------|
| `enemies.js` | 550+ | `BaseEnemy`, `Grunt`, `Elite` classes with state machine |
| `ai-behaviors.js` | 300+ | Pathfinding, cover finding, tactical analysis, perception |
| `enemy-spawner.js` | 350+ | Wave management, spawn points, difficulty presets |
| `game.js` | Updated | Enemy system integration, collision detection |
| `index.html` | Updated | Script references |

### Class Hierarchy

```
BaseEnemy (abstract)
├── Grunt (weak, fast)
└── Elite (strong, tactical)

Support Classes:
├── PathfindingHelper
├── CoverFinder
├── TacticalAnalyzer
├── PerceptionHelper
├── GroupBehavior
├── AnimationController
├── DamageSystem
├── EnemySpawner
├── WavePreset
└── SpawnPointManager
```

## Enemy Types

### Grunt
- **Health:** 10 HP
- **Speed:** 12 units/sec (fast)
- **Melee Damage:** 8
- **Ranged Damage:** 10
- **Grenades:** 1
- **Behavior:** Aggressive melee, frequent charges
- **Vision Range:** 20 (patrol), 40 (alert), 60 (combat)

### Elite
- **Health:** 50 HP
- **Speed:** 8 units/sec (slower, tanky)
- **Melee Damage:** 25 (plasma sword)
- **Ranged Damage:** 15 (plasma rifle)
- **Grenades:** 2
- **Shield:** 25 HP (blocks 60% damage until broken)
- **Behavior:** Tactical flanking, strategic positioning

## State Machine

### PATROL
**Triggers to:** ALERT (player spotted)

**Behavior:**
- Wander between random waypoints
- Slow head rotation (scanning)
- Low alertness

**Vision Range:** 20 units

### ALERT
**Triggers to:**
- COMBAT (player spotted)
- PATROL (>3 seconds without contact)

**Behavior:**
- Move toward last known player position
- Search head movement
- Medium alertness

**Vision Range:** 40 units

### COMBAT
**Triggers to:**
- ALERT (player >60 units and lost sight)
- (Never returns to PATROL once engaged)

**Behavior:**
- Face and track player
- Ranged attacks (medium distance)
- Melee attacks (close range <5 units)
- Grenade throws (behind cover, >8 units)
- Strafing and flanking

**Vision Range:** 60 units

## Setup & Configuration

### 1. Asset Structure

Create this directory structure in your project:

```
fps-game/
├── index.html
├── game.js
├── enemies.js
├── ai-behaviors.js
├── enemy-spawner.js
└── assets/
    └── enemies/
        ├── grunt_1.glb
        ├── grunt_2.glb
        ├── grunt_3.glb
        ├── elite_1.glb
        ├── elite_2.glb
        └── elite_3.glb
```

### 2. Get Free 3D Assets

#### Option A: Download from Sketchfab

**Elite Models:**
- [Halo 4 Covenant Elites](https://sketchfab.com/3d-models/enemieshalo-4covenantelites-3072f3df595349e29a98621182245231) by jameslucino117
- [Halo 5 Elites](https://sketchfab.com/3d-models/halo-5-elites-90146747d76f45a0b73c9f280a568600) by marcosacevez57

**Grunt Models:**
- [Halo 4 Covenant Grunts](https://sketchfab.com/3d-models/enemieshalo-4covenantgrunts-824b06222765476a8775675e22709289) by jameslucino117
- [Halo Reach Grunts](https://sketchfab.com/3d-models/grunts-halo-reach-a4e99f48107c42738714614e5a96f130) by Fliqpy717

**Steps:**
1. Visit Sketchfab link
2. Download as GLB format
3. Save to `fps-game/assets/enemies/`
4. Rename to `grunt_1.glb`, `elite_1.glb`, etc.

#### Option B: Generate with AI (Tripo 3D)

**Services:**
- [Tripo 3D](https://www.tripo3d.ai/) - Game-ready, fast, quad-based topology
- [Meshy AI](https://www.meshy.ai/) - Enterprise-grade, auto-rigging

**How to generate:**

1. **Sign up for free tier** (~300 credits/month)

2. **Generate via API (Python example):**

```python
import asyncio
import json
from urllib import request, parse

async def generate_3d_model(prompt, style='default'):
    api_key = 'your-tripo3d-api-key'

    # Create task
    data = {
        'type': 'text_to_model',
        'prompt': prompt,
        'model_version': 'v3.0',
        'style': style
    }

    req = request.Request(
        'https://api.tripo3d.ai/v2/openapi/models',
        data=json.dumps(data).encode(),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    with request.urlopen(req) as response:
        result = json.loads(response.read())
        task_id = result['data']['task_id']
        print(f'Task created: {task_id}')
        return task_id

# Generate examples
asyncio.run(generate_3d_model('Halo Grunt alien with small stocky frame'))
asyncio.run(generate_3d_model('Halo Elite armored warrior tall elegant'))
```

3. **Download GLB file when ready**

4. **Save to `assets/enemies/`**

**Prompts that work well:**

```
Grunt prompts:
- "Halo Grunt alien small stocky mandible mouth protective suit"
- "Sci-fi alien soldier compact frame short stature"
- "Covenant fighter diminutive armored"

Elite prompts:
- "Halo Elite armored warrior tall elegant plasma sword"
- "Sci-fi alien commander tall imposing armor"
- "Advanced alien species sleek futuristic warrior"
```

### 3. Initialize Enemy System (in game.js)

```javascript
// Done automatically on game load - check game.js for:
// initializeEnemySystem() called after 1 second
// Spawn points registered in your level coordinates
// First wave starts automatically
```

### 4. Configure Spawn Points

Edit spawn point positions in `game.js`:

```javascript
const spawnPoints = [
  new BABYLON.Vector3(50, 2, 50),   // Corner 1
  new BABYLON.Vector3(-50, 2, 50),  // Corner 2
  // ... etc
];
```

Adjust Y value (2) to match your terrain height.

### 5. Configure Wave Difficulty

In `game.js`, change difficulty:

```javascript
const campaignWaves = EnemySpawner.createCampaignWaves('normal');
// Options: 'tutorial', 'easy', 'normal', 'hard', 'legendary'
```

Or define custom waves:

```javascript
enemySpawner.addWave({
  delay: 0,
  enemies: [
    {type: 'grunt', count: 5},
    {type: 'elite', count: 2}
  ]
});
```

## Gameplay Features

### Enemy Behavior

**Perception:**
- Line-of-sight raycasting detects if player is visible
- Hearing distance: 30 units (normal), 50 (gunfire), 60 (grenades)
- FOV cone: 120 degrees

**Combat Tactics:**
- **Melee:** Charges when within 5 units, deals damage
- **Ranged:** Fires projectiles with accuracy based on type
  - Grunts: 65% accuracy (spray & pray)
  - Elites: 85% accuracy (more tactical)
- **Grenades:** Thrown when player behind cover (>8 units, <40 units)
- **Flanking:** Especially aggressive when low health (<30%)
- **Strafing:** Circles player while maintaining distance

**Cover System:**
- Identifies static meshes as potential cover
- Seeks cover when under heavy fire
- Uses cover corners for positioning

### Wave Progression

**Tutorial:** 2-3 Grunts intro
**Easy:** Mix of 5-7 Grunts with 1-2 Elites
**Normal:** Balanced encounters with strategic Elite placement
**Hard:** Elite-heavy, outnumbered scenarios
**Legendary:** 2-3 Elites per wave, constant pressure

### Difficulty Scaling

```javascript
enemySpawner.setDifficulty(1.5); // 1.5x health/damage
```

## Customization

### Tune Enemy Stats

Edit in `enemies.js`:

```javascript
class Grunt extends BaseEnemy {
  constructor(position, scene) {
    super(position, scene, 'grunt');
    this.maxHealth = 10;      // Change here
    this.moveSpeed = 12;      // Change here
    this.meleeDamage = 8;     // Change here
    this.grenadeCount = 1;    // Change here
  }
}
```

### Tune AI Parameters

Edit in `BaseEnemy`:

```javascript
this.visionRange = 20;         // How far they see
this.fov = Math.PI / 1.5;     // 120 degrees vision cone
this.attackCooldown = 0.8;    // Seconds between attacks
this.flankDistance = 25;      // How far to flank
```

### Add Custom Waves

```javascript
enemySpawner.addWave({
  delay: 45,
  enemies: [
    {type: 'grunt', count: 4},
    {type: 'elite', count: 3}
  ]
});
```

## Integration with Game Systems

### Bullet Collision

```javascript
// In mousedown event handler (game.js):
if (enemy.mesh === hit.pickedMesh) {
  enemy.takeDamage(damage);  // Works!
}
```

### Health Management

```javascript
// Enemy health automatically tracked
enemy.takeDamage(25);  // Reduces health
enemy.health          // Current health
enemy.isDead          // Boolean state
```

### Wave Transitions

```javascript
// Start next wave automatically or manually
if (enemySpawner.getAliveEnemies().length === 0) {
  enemySpawner.startWave(enemySpawner.currentWave + 1);
}
```

### HUD Updates

```javascript
// Automatically shows in status display:
const waveStatus = enemySpawner.getWaveStatus();
// {
//   waveNumber: 1,
//   active: true,
//   enemiesAlive: 5,
//   totalEnemies: 8,
//   timeElapsed: 23.4
// }
```

## Troubleshooting

### Models Not Loading

**Problem:** Enemies appear as colored boxes instead of actual models

**Solutions:**
1. Check file paths in `assets/enemies/` directory
2. Ensure GLB files are valid (download again if corrupted)
3. Check browser console for 404 errors
4. Fallback meshes (colored cylinders/spheres) will auto-appear

### Enemies Not Spawning

**Problem:** No enemies appear on map

**Solutions:**
1. Check spawn point coordinates match your level terrain
2. Verify `initializeEnemySystem()` is called
3. Check browser console for errors
4. Ensure wave configuration is valid

### Performance Issues

**Problem:** Game slows down with many enemies

**Solutions:**
1. Reduce enemy count per wave in wave config
2. Disable mesh visualization (comment out spawnPoints visualization)
3. Reduce vision range for enemies
4. Lower difficulty multiplier
5. Use simpler 3D models (fewer polygons)

### AI Too Easy/Hard

**Problem:** Enemies don't challenge player enough (or too hard)

**Solutions:**

*Too Easy:*
- Increase enemy health: `this.maxHealth = 25`
- Increase damage: `this.weaponDamage = 20`
- Increase accuracy: Change 0.65 to 0.85 in `attemptRangedAttack`

*Too Hard:*
- Decrease health
- Increase vision range (harder to sneak)
- Actually, decrease vision range instead
- Reduce ranged attack accuracy
- Increase cooldown between attacks

## Advanced Features

### Custom Behavior Trees

Extend `BaseEnemy` to create new types:

```javascript
class Brute extends BaseEnemy {
  constructor(position, scene) {
    super(position, scene, 'brute');
    this.maxHealth = 100;
    this.meleeDamage = 40;
    // Custom behavior override
  }

  updateCombatState(deltaTime, gameState) {
    // Custom aggressive behavior
    this.moveTowardPlayer(gameState.player.position);
    this.attemptMeleeAttack(gameState);
  }
}
```

### Group Formations

```javascript
const formation = GroupBehavior.calculateGroupFormation(
  enemySpawner.enemies,
  formationCenter,
  'wedge'  // 'line', 'wedge', 'circle'
);
```

### Sound Events

```javascript
// Extend perception for reactive audio
PerceptionHelper.canHearSound(
  enemy.position,
  playerPos,
  50,
  'gunfire'  // Different range
);
```

## Performance Notes

- Tested up to 20 active enemies
- Raycasting done once per enemy per frame (optimized)
- LOD system recommended for 30+ enemies
- Use quad-based models (Tripo 3D) for better performance

## Future Improvements

- [ ] Animation blending and skeletal animation
- [ ] Leaderboard/score system
- [ ] Boss encounters
- [ ] Vehicle-mounted enemies
- [ ] Squad commanding
- [ ] Dynamic difficulty adjustment
- [ ] Audio-based perception (enemy vocalizations)
- [ ] Grenade stick physics
- [ ] Shield recharging for Elites
- [ ] Special abilities (invulnerability, berserk)

## References

- [Babylon.js Documentation](https://doc.babylonjs.com/)
- [State Machines in Games](https://gameprogrammingpatterns.com/state.html)
- [Halo Enemy AI Behavior](https://www.youtube.com/watch?v=mZkP2qy9Zhs)
- [3D Model Best Practices](https://doc.babylonjs.com/features/featuresDeepDive/Babylon.js_and_Blender)
