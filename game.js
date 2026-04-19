// Halo CE-Inspired FPS Game - Babylon.js Implementation
// Features: Dual-layer health (shields + health), 2-weapon system, plasma grenades

let canvas = document.getElementById('gameCanvas');
let engine = new BABYLON.Engine(canvas, true);

// Scene setup
let scene = new BABYLON.Scene(engine);
scene.collisionsEnabled = true;
scene.gravity = new BABYLON.Vector3(0, -20, 0);
scene.clearColor = new BABYLON.Color4(0.44, 0.64, 0.94, 1);

// Lighting (temporary — level.js will replace these with its own)
let light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.01;

// ============================================================================
// GAME SYSTEMS
// ============================================================================

class ShieldSystem {
  constructor() {
    this.maxShields = 100;
    this.shields = this.maxShields;
    this.rechargeRate = 20; // points per second
    this.rechargeDelay = 3; // seconds before recharging starts
    this.lastDamageTime = 0;
    this.isRecharging = false;
  }

  takeDamage(amount) {
    this.lastDamageTime = performance.now() / 1000;

    if (amount > 0) {
      // Play damage sound and show vignette flash
      if (window.soundSystem) window.soundSystem.playPlayerDamage();
      const vig = document.getElementById('damageVignette');
      if (vig) {
        vig.classList.add('active');
        setTimeout(() => vig.classList.remove('active'), 200);
      }
    }

    // Shields block 50% of damage
    const shieldDamage = Math.min(this.shields, amount * 0.5);
    const healthDamage = amount - shieldDamage;

    this.shields = Math.max(0, this.shields - shieldDamage);
    this.isRecharging = false;

    return healthDamage; // Return damage that bypasses shields
  }

  update(deltaTime) {
    const timeSinceLastDamage = (performance.now() / 1000) - this.lastDamageTime;
    
    if (timeSinceLastDamage > this.rechargeDelay && this.shields < this.maxShields) {
      this.shields = Math.min(this.maxShields, this.shields + (this.rechargeRate * deltaTime));
      this.isRecharging = true;
    } else if (this.shields >= this.maxShields) {
      this.isRecharging = false;
    }
  }

  getShieldPercent() {
    return (this.shields / this.maxShields) * 100;
  }
}

class HealthSystem {
  constructor() {
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.isDead = false;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  reset() {
    this.health = this.maxHealth;
    this.isDead = false;
  }

  getHealthPercent() {
    return (this.health / this.maxHealth) * 100;
  }
}

class Weapon {
  constructor(name, fireRate, damage, magSize, totalAmmo) {
    this.name = name;
    this.fireRate = fireRate; // rounds per second
    this.damage = damage; // damage per shot
    this.magSize = magSize;
    this.magAmmo = magSize;
    this.totalAmmo = totalAmmo;
    this.lastFireTime = 0;
  }

  canFire(currentTime) {
    return this.magAmmo > 0 && (currentTime - this.lastFireTime) >= (1 / this.fireRate);
  }

  fire(currentTime) {
    if (this.canFire(currentTime)) {
      this.magAmmo--;
      this.lastFireTime = currentTime;
      return true;
    }
    return false;
  }

  reload() {
    const ammoNeeded = this.magSize - this.magAmmo;
    const ammoToLoad = Math.min(ammoNeeded, this.totalAmmo);
    this.magAmmo += ammoToLoad;
    this.totalAmmo -= ammoToLoad;
  }

  getAmmoDisplay() {
    return `${this.magAmmo}/${this.totalAmmo}`;
  }
}

class WeaponSystem {
  constructor() {
    this.maxWeapons = 2;
    this.weapons = [
      new Weapon('Assault Rifle', 10, 22, 60, 300),
      new Weapon('Pistol', 3, 15, 12, 120)
    ];
    this.currentWeaponIndex = 0;
    this.lastFireTime = 0;
  }

  getCurrentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  switchWeapon(index) {
    if (index >= 0 && index < this.weapons.length) {
      this.currentWeaponIndex = index;
    }
  }

  fireCurrentWeapon(currentTime) {
    const weapon = this.getCurrentWeapon();
    if (weapon.fire(currentTime)) {
      this.lastFireTime = currentTime;
      return weapon.damage;
    }
    return 0;
  }

  reloadCurrentWeapon() {
    this.getCurrentWeapon().reload();
  }

  getWeaponDisplay() {
    const weapon = this.getCurrentWeapon();
    return `${weapon.name} - ${weapon.getAmmoDisplay()}`;
  }
}

class GrenadeSystem {
  constructor(scene) {
    this.scene = scene;
    this.maxGrenades = 4;
    this.grenadeCount = this.maxGrenades;
    this.grenades = [];
    this.detonationTime = 3; // seconds
    this.explosionRadius = 15;
    this.maxExplosionDamage = 100;
  }

  throwGrenade(position, direction, velocity = 7) {
    if (this.grenadeCount <= 0) return false;

    // Create grenade mesh
    const grenade = BABYLON.MeshBuilder.CreateSphere('grenade', { diameter: 0.3 }, this.scene);
    grenade.position = position.clone();
    
    // Grenade material (glowing blue)
    const grenadeMat = new BABYLON.StandardMaterial('grenadeMat', this.scene);
    grenadeMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
    grenadeMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    grenade.material = grenadeMat;

    // Physics
    grenade.velocity = direction.scale(velocity);
    grenade.gravity = -20;
    grenade.thrownTime = performance.now() / 1000;
    grenade.hasDetonated = false;
    grenade.isStuck = false;

    this.grenades.push(grenade);
    this.grenadeCount--;

    return true;
  }

  update(deltaTime) {
    const currentTime = performance.now() / 1000;

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const grenade = this.grenades[i];

      if (grenade.hasDetonated) {
        grenade.dispose();
        this.grenades.splice(i, 1);
        continue;
      }

      // Update position (simple gravity simulation)
      if (!grenade.isStuck) {
        grenade.velocity.y += grenade.gravity * deltaTime;
        grenade.position.addInPlace(grenade.velocity.scale(deltaTime));

        // Ground collision (simple flat ground at y=0)
        if (grenade.position.y <= 0.15) {
          grenade.position.y = 0.15;
          grenade.velocity.y *= -0.6; // bounce with damping
          grenade.velocity.x *= 0.8;
          grenade.velocity.z *= 0.8;
          grenade.isStuck = true;
        }

        // Wall collision detection (basic)
        const ray = new BABYLON.Ray(grenade.position, BABYLON.Vector3.Zero(), 1);
        const hit = this.scene.pickWithRay(ray, (mesh) => mesh.name !== 'ground' && mesh.name.indexOf('grenade') === -1);
        if (hit && hit.hit) {
          grenade.isStuck = true;
          grenade.velocity = BABYLON.Vector3.Zero();
        }
      }

      // Grenade pulsing effect (brightness increases as detonation approaches)
      const timeSinceThrow = currentTime - grenade.thrownTime;
      const timeUntilDetonation = this.detonationTime - timeSinceThrow;
      
      if (timeUntilDetonation <= 1) {
        // Pulse rapidly in final second
        const pulse = Math.sin(currentTime * 20) * 0.5 + 0.5;
        grenade.material.emissiveColor = new BABYLON.Color3(0, 0.8 * pulse, 1 * pulse);
      }

      // Check for detonation
      if (timeSinceThrow >= this.detonationTime) {
        this.detonate(grenade);
      }
    }
  }

  detonate(grenade) {
    // Play explosion sound
    if (window.soundSystem) window.soundSystem.playExplosion();

    const explosionPos = grenade.position;

    // Create explosion effect (temporary sphere)
    const explosion = BABYLON.MeshBuilder.CreateSphere('explosion', { diameter: this.explosionRadius * 2 }, this.scene);
    explosion.position = explosionPos;
    
    const explosionMat = new BABYLON.StandardMaterial('explosionMat', this.scene);
    explosionMat.emissiveColor = new BABYLON.Color3(1, 0.7, 0);
    explosion.material = explosionMat;
    
    // Fade out explosion effect
    setTimeout(() => explosion.dispose(), 100);

    grenade.hasDetonated = true;
    
    // Return explosion info for damage handling
    return { position: explosionPos, radius: this.explosionRadius, maxDamage: this.maxExplosionDamage };
  }

  calculateExplosionDamage(explosionPos, targetPos) {
    const distance = BABYLON.Vector3.Distance(explosionPos, targetPos);
    if (distance > this.explosionRadius) return 0;
    
    // Linear falloff
    const damage = this.maxExplosionDamage * (1 - (distance / this.explosionRadius));
    return damage;
  }

  getGrenadeCount() {
    return this.grenadeCount;
  }
}

// ============================================================================
// CAMERA & PLAYER SETUP
// ============================================================================

// ============================================================================
// BUILD LEVEL — must happen before camera so playerStart is available
// ============================================================================
let levelData = window.buildLevel(scene);

// ============================================================================
// CAMERA & PLAYER SETUP
// ============================================================================

let playerHeight = 1.85;
let camera = new BABYLON.UniversalCamera('camera', levelData.playerStart.clone(), scene);
camera.attachControl(canvas, true);
camera.inertia = 0.7;
camera.angularSensibility = 1000;
camera.keysUp = [];
camera.keysDown = [];
camera.keysLeft = [];
camera.keysRight = [];

// Pointer lock
canvas.addEventListener('click', () => canvas.requestPointerLock());

// ============================================================================
// GAME STATE
// ============================================================================

let shieldSystem = new ShieldSystem();
let healthSystem = new HealthSystem();
let weaponSystem = new WeaponSystem();
let grenadeSystem = new GrenadeSystem(scene);

// Kill counter and time for win/death screens
let killCount = 0;
let gameStartTime = performance.now() / 1000;
let gameOver = false;       // true = win screen showing, loop paused
let deathScreenActive = false; // true = death screen countdown in progress
let ambientStarted = false;

// Radar sweep angle
let radarSweepAngle = 0;

// VehicleSystem is defined in vehicle.js (loaded before game.js)
// We declare the variable here; it is instantiated below after `keys` exists.
let vehicleSystem = null;

let playerStartPos = levelData.playerStart.clone();
let playerVelocity = BABYLON.Vector3.Zero();
let playerSpeed = 10;
let jumpPower = 8;
let isGrounded = false;

// ============================================================================
// GROUND DETECTION — terrain-aware downward raycast
// ============================================================================

// Downward ray from camera position; finds the highest solid mesh below
const _downRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), 80);

function getGroundY(pos) {
  _downRay.origin.copyFrom(pos);
  _downRay.origin.y += 0.5; // start slightly above feet
  const hit = scene.pickWithRay(_downRay, (mesh) =>
    mesh.checkCollisions && mesh !== levelData.skyDome
  );
  if (hit && hit.hit && hit.pickedPoint) {
    return hit.pickedPoint.y;
  }
  // Fallback to mathematical terrain height
  return levelData.getTerrainHeight(pos.x, pos.z);
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

let keys = {};
window.addEventListener('keydown', (e) => {
  // Restart on win screen
  if (gameOver && e.key.toLowerCase() === 'r') {
    location.reload();
    return;
  }

  // Use e.key directly for space and Tab; lowercase everything else
  const k = e.key === ' ' ? ' ' : e.key === 'Tab' ? 'tab' : e.key.toLowerCase();
  keys[k] = true;

  // Prevent Tab from switching browser focus
  if (e.key === 'Tab') e.preventDefault();

  // Weapon switching (only when not in vehicle)
  if (!vehicleSystem || !vehicleSystem.activeVehicle) {
    if (e.key === '1') weaponSystem.switchWeapon(0);
    if (e.key === '2') weaponSystem.switchWeapon(1);

    // Reload
    if (e.key.toLowerCase() === 'r') weaponSystem.reloadCurrentWeapon();

    // Grenade throw
    if (e.key.toLowerCase() === 'g') {
      grenadeSystem.throwGrenade(
        camera.position.add(BABYLON.Vector3.Forward()),
        camera.getDirection(BABYLON.Vector3.Forward())
      );
    }

    // Jump
    if (e.key === ' ') {
      if (isGrounded) {
        playerVelocity.y = jumpPower;
        isGrounded = false;
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key === ' ' ? ' ' : e.key === 'Tab' ? 'tab' : e.key.toLowerCase();
  keys[k] = false;
});

// Mouse firing — only active when on foot (not in vehicle)
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    // If in vehicle as passenger, turret handles firing via VehicleSystem
    if (vehicleSystem && vehicleSystem.activeVehicle) return;

    const damage = weaponSystem.fireCurrentWeapon(performance.now() / 1000);
    if (damage > 0) {
      // Play gunshot sound
      if (window.soundSystem) {
        const wt = weaponSystem.getCurrentWeapon().name === 'Pistol' ? 'pistol' : 'rifle';
        window.soundSystem.playShot(wt);
      }
      // Raycast from camera center
      const origin = camera.position;
      const direction = camera.getDirection(BABYLON.Vector3.Forward());
      const length = 100;
      const ray = new BABYLON.Ray(origin, direction, length);

      const hit = scene.pickWithRay(ray, (mesh) => mesh.isPickable && mesh.name.indexOf('grenade') === -1);
      if (hit && hit.hit && hit.pickedMesh) {
        // Check if bullet hit an enemy
        if (enemySpawner) {
          for (let enemy of enemySpawner.enemies) {
            if (enemy.mesh === hit.pickedMesh) {
              const wasAlive = !enemy.isDead;
              enemy.takeDamage(damage);
              DamageSystem.createImpactEffect(hit.pickedPoint, scene, new BABYLON.Color3(0.8, 0, 0));
              if (wasAlive && enemy.isDead) killCount++;
              break;
            }
          }
        }

        // Visual feedback
        const hitPoint = hit.pickedPoint;
        const flash = BABYLON.MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.5 }, scene);
        flash.position = hitPoint;
        let flashMat = new BABYLON.StandardMaterial('flashMat', scene);
        flashMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
        flash.material = flashMat;
        setTimeout(() => flash.dispose(), 50);
      }
    }
  }
});

// Instantiate vehicle system — must happen after `keys` is defined
vehicleSystem = new VehicleSystem(scene, camera, levelData.getTerrainHeight, keys);

// ============================================================================
// ENEMY SYSTEM INITIALIZATION
// ============================================================================

let enemySpawner = null;
let grenades = []; // Grenades thrown by both player and enemies

// Initialize enemy spawner after level loads
function initializeEnemySystem() {
  enemySpawner = new EnemySpawner(scene);

  // Register spawn points (positions from the ring-world arena)
  // Adjust these coordinates to match your actual level geometry
  const spawnPoints = [
    new BABYLON.Vector3(50, 2, 50),   // Corner 1
    new BABYLON.Vector3(-50, 2, 50),  // Corner 2
    new BABYLON.Vector3(50, 2, -50),  // Corner 3
    new BABYLON.Vector3(-50, 2, -50), // Corner 4
    new BABYLON.Vector3(30, 2, 0),    // Side 1
    new BABYLON.Vector3(-30, 2, 0),   // Side 2
    new BABYLON.Vector3(0, 2, 30),    // Side 3
    new BABYLON.Vector3(0, 2, -30)    // Side 4
  ];

  spawnPoints.forEach(pos => {
    enemySpawner.registerSpawnPoint(pos, 'any');
  });

  // Setup campaign waves
  const campaignWaves = EnemySpawner.createCampaignWaves('normal');
  campaignWaves.forEach(wave => {
    enemySpawner.addWave(wave);
  });

  console.log('Enemy system initialized with ' + spawnPoints.length + ' spawn points');
}

// Call after level is fully loaded
setTimeout(() => {
  initializeEnemySystem();
  // Start first wave
  if (enemySpawner) {
    enemySpawner.startWave(0);
  }
}, 1000);

// ============================================================================
// COLLISION & DAMAGE HELPERS
// ============================================================================

/**
 * Check if player bullets hit any enemies
 */
function checkBulletEnemyCollision() {
  if (!enemySpawner || !enemySpawner.enemies) return;

  // This is a simplified version - in a full game you'd track each bullet
  // For now, raycasts from the previous update handle hits
  // (See mousedown handler above)
}

/**
 * Check if enemy grenades hit the player
 */
function checkGrenadePlayerCollision() {
  // Player grenades are handled by grenadeSystem
  // Enemy grenades would be in enemySpawner's tracking

  // Example: check distance to enemy grenades
  if (!enemySpawner) return;

  enemySpawner.enemies.forEach(enemy => {
    // This would be called during enemy grenade updates
    // Implementation depends on where grenades are stored
  });
}

// ============================================================================
// HUD UPDATES
// ============================================================================

function updateHUD() {
  const shieldBar = document.getElementById('shieldBar');
  const healthBar = document.getElementById('healthBar');
  const ammoDisplay = document.getElementById('ammoDisplay');
  const grenadeDisplay = document.getElementById('grenadeDisplay');

  shieldBar.style.width = Math.max(0, shieldSystem.getShieldPercent()) + '%';
  healthBar.style.width = Math.max(0, healthSystem.getHealthPercent()) + '%';
  ammoDisplay.textContent = weaponSystem.getWeaponDisplay();
  grenadeDisplay.textContent = `Grenades: ${grenadeSystem.getGrenadeCount()}/4`;

  // Status display with enemy count
  const statusDisplay = document.getElementById('statusDisplay');
  if (statusDisplay) {
    let statusText = `Health: ${Math.ceil(healthSystem.health)} | Shields: ${Math.ceil(shieldSystem.shields)}`;

    if (enemySpawner) {
      const waveStatus = enemySpawner.getWaveStatus();
      const aliveEnemies = waveStatus.enemiesAlive;
      statusText += ` | Wave: ${waveStatus.waveNumber} | Enemies: ${aliveEnemies}`;
    }

    statusText += ` | Kills: ${killCount}`;

    // Extra message (e.g. AMMO PICKUP) shown briefly
    if (statusDisplay._extraMsg && performance.now() < statusDisplay._extraMsgExpiry) {
      statusText += `  >>  ${statusDisplay._extraMsg}`;
    }

    statusDisplay.textContent = statusText;
  }
}

// ============================================================================
// MOTION TRACKER (RADAR)
// ============================================================================

const radarCanvas = document.getElementById('radarCanvas');
const radarCtx = radarCanvas ? radarCanvas.getContext('2d') : null;
const RADAR_RADIUS = 60;   // px — half the canvas
const RADAR_WORLD_RANGE = 60; // world units represented by the radar

function updateRadar(deltaTime) {
  if (!radarCtx) return;

  // Advance sweep
  radarSweepAngle += deltaTime * Math.PI; // ~0.5 rev/sec

  const cx = RADAR_RADIUS;
  const cy = RADAR_RADIUS;
  const r = RADAR_RADIUS - 2;

  radarCtx.clearRect(0, 0, 120, 120);

  // Dark semi-transparent background circle
  radarCtx.save();
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
  radarCtx.fillStyle = 'rgba(0, 20, 10, 0.75)';
  radarCtx.fill();

  // Outer ring
  radarCtx.strokeStyle = 'rgba(0, 220, 80, 0.8)';
  radarCtx.lineWidth = 2;
  radarCtx.stroke();

  // Inner grid rings (subtle)
  radarCtx.strokeStyle = 'rgba(0, 180, 60, 0.2)';
  radarCtx.lineWidth = 1;
  [0.5].forEach(frac => {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, r * frac, 0, Math.PI * 2);
    radarCtx.stroke();
  });

  // Clip subsequent drawing to circle
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
  radarCtx.clip();

  // Sweep line
  const sweepEndX = cx + Math.cos(radarSweepAngle) * r;
  const sweepEndY = cy + Math.sin(radarSweepAngle) * r;

  const sweepGrad = radarCtx.createLinearGradient(cx, cy, sweepEndX, sweepEndY);
  sweepGrad.addColorStop(0, 'rgba(0, 220, 80, 0.0)');
  sweepGrad.addColorStop(1, 'rgba(0, 220, 80, 0.55)');

  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy);
  radarCtx.lineTo(sweepEndX, sweepEndY);
  radarCtx.strokeStyle = sweepGrad;
  radarCtx.lineWidth = 2;
  radarCtx.stroke();

  // Enemy blips
  if (enemySpawner) {
    const playerPos = camera.position;
    const playerYaw = camera.rotation.y;

    for (const enemy of enemySpawner.enemies) {
      if (enemy.isDead || !enemy.mesh) continue;

      const dx = enemy.position.x - playerPos.x;
      const dz = enemy.position.z - playerPos.z;
      const worldDist = Math.sqrt(dx * dx + dz * dz);

      if (worldDist > RADAR_WORLD_RANGE) continue;

      // Rotate by player yaw so forward is "up" on radar
      const rotX = dx * Math.cos(-playerYaw) - dz * Math.sin(-playerYaw);
      const rotZ = dx * Math.sin(-playerYaw) + dz * Math.cos(-playerYaw);

      const radarX = cx + (rotX / RADAR_WORLD_RANGE) * r;
      const radarY = cy + (rotZ / RADAR_WORLD_RANGE) * r;  // Z maps to Y on screen

      // Blip colour: amber if moving, dimmer if still
      const speed = enemy.velocity ? enemy.velocity.length() : 0;
      const blipColor = speed > 0.5
        ? 'rgba(255, 160, 0, 0.95)'
        : 'rgba(200, 110, 0, 0.45)';

      radarCtx.beginPath();
      radarCtx.arc(radarX, radarY, 3, 0, Math.PI * 2);
      radarCtx.fillStyle = blipColor;
      radarCtx.fill();
    }
  }

  // Center dot (player)
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  radarCtx.fillStyle = 'rgba(0, 255, 100, 1)';
  radarCtx.fill();

  radarCtx.restore();
}

// ============================================================================
// WEAPON PICKUP COLLECTION
// ============================================================================

function updatePickups(deltaTime) {
  window.weaponPickups = window.weaponPickups || [];
  const now = performance.now() / 1000;

  for (let i = window.weaponPickups.length - 1; i >= 0; i--) {
    const pickup = window.weaponPickups[i];
    if (!pickup || pickup.isDisposed()) {
      window.weaponPickups.splice(i, 1);
      continue;
    }

    // Bob up and down
    pickup._bobTime = (pickup._bobTime || 0) + deltaTime * 2.5;
    pickup.position.y = pickup._bobOriginY + Math.sin(pickup._bobTime) * 0.15;

    // Check player proximity
    const dist = BABYLON.Vector3.Distance(camera.position, pickup.position);
    if (dist < 2.0) {
      // Add ammo to matching weapon
      const wType = pickup.weaponType; // 'pistol' or 'rifle'
      const ammo = pickup.ammoAmount;
      for (const w of weaponSystem.weapons) {
        const isMatch = (wType === 'pistol' && w.name === 'Pistol')
          || (wType === 'rifle' && w.name === 'Assault Rifle');
        if (isMatch) {
          w.totalAmmo += ammo;
          // Optionally refill mag if empty
          if (w.magAmmo === 0) {
            const fill = Math.min(w.magSize, w.totalAmmo);
            w.magAmmo += fill;
            w.totalAmmo -= fill;
          }
          break;
        }
      }

      // Play pickup sound
      if (window.soundSystem) window.soundSystem.playPickup();

      // Show brief status message
      showStatusMessage('AMMO PICKUP');

      // Dispose and remove
      pickup.dispose();
      window.weaponPickups.splice(i, 1);
    }
  }
}

// ============================================================================
// STATUS MESSAGE HELPER
// ============================================================================

let _statusTimeout = null;
function showStatusMessage(text, durationMs = 2000) {
  const el = document.getElementById('statusDisplay');
  if (!el) return;
  // Append extra line; the normal HUD update will overwrite the base line
  el._extraMsg = text;
  el._extraMsgExpiry = performance.now() + durationMs;
  if (_statusTimeout) clearTimeout(_statusTimeout);
  _statusTimeout = setTimeout(() => {
    el._extraMsg = null;
  }, durationMs);
}

// ============================================================================
// WIN SCREEN
// ============================================================================

function showWinScreen() {
  if (gameOver) return;
  gameOver = true;
  const elapsed = Math.floor(performance.now() / 1000 - gameStartTime);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('winStats').textContent =
    `Kills: ${killCount}   |   Time: ${mins}:${secs}`;
  document.getElementById('winScreen').style.display = 'flex';
}

// ============================================================================
// DEATH SCREEN & RESPAWN
// ============================================================================

function triggerDeathScreen() {
  if (deathScreenActive) return;
  deathScreenActive = true;

  const deathScreen = document.getElementById('deathScreen');
  const countdownEl = document.getElementById('deathCountdown');
  deathScreen.style.display = 'flex';

  let count = 3;
  countdownEl.textContent = `Respawning in ${count}...`;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = `Respawning in ${count}...`;
    } else {
      clearInterval(interval);
      deathScreen.style.display = 'none';
      deathScreenActive = false;
      doRespawn();
    }
  }, 1000);
}

function doRespawn() {
  // Exit vehicle if in one
  if (vehicleSystem && vehicleSystem.activeVehicle) {
    vehicleSystem._exitVehicle();
  }
  camera.position = playerStartPos.clone();
  playerVelocity = BABYLON.Vector3.Zero();
  healthSystem.reset();
  shieldSystem.shields = shieldSystem.maxShields;
  weaponSystem.weapons.forEach(w => {
    w.magAmmo = w.magSize;
    w.totalAmmo = w.magSize * 4;
  });
  grenadeSystem.grenadeCount = grenadeSystem.maxGrenades;
  grenadeSystem.grenades = [];

  // Reset enemy wave
  if (enemySpawner) {
    enemySpawner.startWave(Math.min(enemySpawner.currentWave, enemySpawner.waves.length - 1));
  }
}

// ============================================================================
// WIN CONDITION CHECK
// ============================================================================

function checkWinCondition() {
  if (!enemySpawner || gameOver) return;
  const status = enemySpawner.getWaveStatus();
  const isLastWave = (enemySpawner.currentWave >= enemySpawner.waves.length - 1);
  const noSpawnPending = !enemySpawner.waveActive || (enemySpawner.enemyQueue && enemySpawner.enemyQueue.length === 0);
  if (isLastWave && noSpawnPending && status.enemiesAlive === 0 && status.totalEnemies > 0) {
    showWinScreen();
  }
}

// ============================================================================
// GAME LOOP
// ============================================================================

engine.runRenderLoop(() => {
  // Pause rendering while win screen is showing
  if (gameOver) return;

  const deltaTime = engine.deltaTime / 1000; // Convert to seconds

  // Start ambient sound on first frame after init
  if (!ambientStarted && window.soundSystem && window.soundSystem.initialized) {
    ambientStarted = true;
    window.soundSystem.playAmbient();
  }

  // ---- Update vehicle system first (may reposition camera) ----
  if (vehicleSystem) {
    vehicleSystem.update(deltaTime);
  }

  // ---- On-foot movement (skip when player is inside a vehicle) ----
  const inVehicle = vehicleSystem && vehicleSystem.activeVehicle !== null;

  if (!inVehicle) {
    // Movement input
    let moveDir = BABYLON.Vector3.Zero();
    if (keys['w']) moveDir.addInPlace(camera.getDirection(BABYLON.Vector3.Forward()));
    if (keys['s']) moveDir.addInPlace(camera.getDirection(BABYLON.Vector3.Forward()).scale(-1));
    if (keys['a']) moveDir.addInPlace(camera.getDirection(BABYLON.Vector3.Left()));
    if (keys['d']) moveDir.addInPlace(camera.getDirection(BABYLON.Vector3.Right()));

    moveDir.y = 0; // Ignore vertical component of direction
    if (moveDir.length() > 0) {
      moveDir.normalize();
      playerVelocity.x = moveDir.x * playerSpeed;
      playerVelocity.z = moveDir.z * playerSpeed;
    } else {
      playerVelocity.x *= 0.9;
      playerVelocity.z *= 0.9;
    }

    // Gravity
    playerVelocity.y -= 20 * deltaTime;

    // Update camera position
    camera.position.addInPlace(playerVelocity.scale(deltaTime));

    // Terrain-aware ground collision
    const surfaceY = getGroundY(camera.position) + playerHeight;
    if (camera.position.y <= surfaceY) {
      camera.position.y = surfaceY;
      playerVelocity.y = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }
  } else {
    // While in vehicle, zero out foot velocity so exiting feels natural
    playerVelocity = BABYLON.Vector3.Zero();
    isGrounded = true;
  }

  // Update game systems
  shieldSystem.update(deltaTime);
  grenadeSystem.update(deltaTime);

  // Update enemy system
  if (enemySpawner) {
    const gameState = {
      player: {
        position: camera.position,
        health: healthSystem,
        velocity: playerVelocity
      },
      grenades: grenades,
      enemies: enemySpawner.enemies
    };

    enemySpawner.update(deltaTime, gameState);

    // Check if player bullets hit enemies
    checkBulletEnemyCollision();
  }

  // Check death — gate behind death screen (skip if already in countdown)
  if (healthSystem.isDead && !deathScreenActive) {
    triggerDeathScreen();
  }

  // Update weapon pickups (bob + collection)
  if (!deathScreenActive) {
    updatePickups(deltaTime);
  }

  // Update radar
  updateRadar(deltaTime);

  // Check win condition
  checkWinCondition();

  // Update HUD
  updateHUD();

  // Render
  scene.render();
});

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
});
