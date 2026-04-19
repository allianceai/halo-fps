// ============================================================================
// ENEMY SPAWNER - Wave management, spawn points, difficulty scaling
// ============================================================================

/**
 * EnemySpawner - Manage enemy waves and spawn mechanics
 */
class EnemySpawner {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.spawnPoints = [];
    this.waves = [];
    this.currentWave = 0;
    this.waveActive = false;
    this.waveTimer = 0;
    this.waveStartTime = 0;

    // Configuration
    this.difficultyMultiplier = 1.0;
    this.spawnDelay = 0.5; // seconds between enemy spawns
    this.spawnTimer = 0;
    this.maxEnemiesPerWave = 10;

    // Audio
    this.alertSound = null; // Would load audio file
    this.spawnSound = null;

    // Initialize pathfinding and tactical helpers
    this.pathfinder = new PathfindingHelper(scene);
    this.coverFinder = new CoverFinder(scene);
    this.analyzer = TacticalAnalyzer;
  }

  /**
   * Define spawn points in the level (call from level.js)
   */
  registerSpawnPoint(position, type = 'any') {
    this.spawnPoints.push({
      position: position,
      type: type, // 'grunt', 'elite', 'any'
      lastUsed: 0,
      cooldown: 5 // seconds before reusing
    });
  }

  /**
   * Get list of spawn points (useful for visualization in editor)
   */
  getSpawnPoints() {
    return this.spawnPoints.map(sp => ({
      position: sp.position,
      type: sp.type
    }));
  }

  /**
   * Define a wave of enemies
   */
  addWave(waveConfig) {
    // waveConfig: { delay: seconds, enemies: [{type: 'grunt', count: 3}, ...] }
    this.waves.push(waveConfig);
  }

  /**
   * Start a specific wave
   */
  startWave(waveIndex) {
    if (waveIndex >= this.waves.length) return;

    this.currentWave = waveIndex;
    const waveConfig = this.waves[waveIndex];

    // Clear previous enemies
    this.enemies.forEach(enemy => {
      if (enemy.mesh) enemy.mesh.dispose();
    });
    this.enemies = [];

    // Queue enemies for spawning
    this.waveActive = true;
    this.waveTimer = 0;
    this.waveStartTime = performance.now();
    this.spawnTimer = this.spawnDelay;

    // Prepare enemy queue
    this.enemyQueue = [];
    waveConfig.enemies.forEach(config => {
      for (let i = 0; i < config.count; i++) {
        this.enemyQueue.push(config.type);
      }
    });

    // Shuffle queue for random order
    for (let i = this.enemyQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.enemyQueue[i], this.enemyQueue[j]] = [this.enemyQueue[j], this.enemyQueue[i]];
    }

    console.log(`Wave ${waveIndex + 1} started: ${this.enemyQueue.length} enemies`);
  }

  /**
   * Create predefined waves (used in level setup)
   */
  static createCampaignWaves(difficulty = 'normal') {
    const waves = {
      'easy': [
        { delay: 0, enemies: [{type: 'grunt', count: 2}] },
        { delay: 30, enemies: [{type: 'grunt', count: 3}] },
        { delay: 60, enemies: [{type: 'grunt', count: 2}, {type: 'elite', count: 1}] }
      ],
      'normal': [
        { delay: 0, enemies: [{type: 'grunt', count: 3}] },
        { delay: 20, enemies: [{type: 'elite', count: 1}] },
        { delay: 45, enemies: [{type: 'grunt', count: 2}, {type: 'elite', count: 1}] },
        { delay: 75, enemies: [{type: 'elite', count: 2}] },
        { delay: 100, enemies: [{type: 'grunt', count: 4}, {type: 'elite', count: 1}] }
      ],
      'hard': [
        { delay: 0, enemies: [{type: 'elite', count: 1}, {type: 'grunt', count: 2}] },
        { delay: 15, enemies: [{type: 'elite', count: 2}] },
        { delay: 40, enemies: [{type: 'grunt', count: 3}, {type: 'elite', count: 2}] },
        { delay: 70, enemies: [{type: 'elite', count: 3}, {type: 'grunt', count: 2}] }
      ]
    };

    return waves[difficulty] || waves['normal'];
  }

  /**
   * Update spawning logic
   */
  update(deltaTime, gameState) {
    if (!this.waveActive) return;

    this.spawnTimer -= deltaTime;
    this.waveTimer += deltaTime;

    // Spawn next enemy if timer is ready
    if (this.spawnTimer <= 0 && this.enemyQueue && this.enemyQueue.length > 0) {
      this.spawnEnemy(this.enemyQueue.shift(), gameState);
      this.spawnTimer = this.spawnDelay;
    }

    // Check if wave is complete
    if (this.enemyQueue.length === 0 && this.enemies.filter(e => !e.isDead).length === 0) {
      this.waveActive = false;
      this.onWaveComplete();
    }

    // Update all enemies
    this.enemies.forEach(enemy => {
      if (!enemy.isDead) {
        enemy.update(deltaTime, gameState);
      }
    });

    // Remove dead enemies after a delay
    this.enemies = this.enemies.filter(enemy => {
      if (enemy.isDead && (performance.now() - enemy.lastDamageTime) > 3000) {
        return false; // Remove from list
      }
      return true;
    });
  }

  /**
   * Spawn a single enemy
   */
  spawnEnemy(type, gameState) {
    // Find a suitable spawn point
    const spawnPoint = this.getAvailableSpawnPoint(type);
    if (!spawnPoint) {
      console.warn('No available spawn points');
      return;
    }

    // Create enemy instance
    const enemy = type === 'elite'
      ? new Elite(spawnPoint.position, this.scene)
      : new Grunt(spawnPoint.position, this.scene);

    // Try to load model
    const modelPath = type === 'elite'
      ? `assets/enemies/elite_${Math.floor(Math.random() * 3) + 1}.glb`
      : `assets/enemies/grunt_${Math.floor(Math.random() * 3) + 1}.glb`;

    enemy.loadModel(modelPath);

    // Register in list
    this.enemies.push(enemy);

    // Mark spawn point as used
    spawnPoint.lastUsed = performance.now();

    console.log(`Spawned ${type} at ${spawnPoint.position.toString()}`);
  }

  /**
   * Get available spawn point
   */
  getAvailableSpawnPoint(enemyType) {
    const now = performance.now();

    // Find compatible spawn points
    let available = this.spawnPoints.filter(sp => {
      const timeSinceUsed = (now - sp.lastUsed) / 1000;
      return timeSinceUsed > sp.cooldown && (sp.type === 'any' || sp.type === enemyType);
    });

    // If none available, use any point that matches type
    if (available.length === 0) {
      available = this.spawnPoints.filter(sp => sp.type === 'any' || sp.type === enemyType);
    }

    if (available.length === 0) return null;

    // Return random available point
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Called when wave is complete
   */
  onWaveComplete() {
    console.log(`Wave ${this.currentWave + 1} complete!`);
    // Could trigger UI updates, score bonuses, etc.
  }

  /**
   * Get all alive enemies
   */
  getAliveEnemies() {
    return this.enemies.filter(e => !e.isDead);
  }

  /**
   * Get wave status info
   */
  getWaveStatus() {
    return {
      waveNumber: this.currentWave + 1,
      active: this.waveActive,
      totalWaves: this.waves.length,
      enemiesAlive: this.getAliveEnemies().length,
      totalEnemies: this.enemies.length,
      timeElapsed: this.waveTimer
    };
  }

  /**
   * Difficulty scaling (increases enemy health, damage)
   */
  setDifficulty(multiplier) {
    this.difficultyMultiplier = multiplier;

    // Apply to existing enemies
    this.enemies.forEach(enemy => {
      enemy.maxHealth = Math.ceil(enemy.maxHealth * multiplier);
      enemy.health = enemy.maxHealth;
      enemy.meleeDamage = Math.ceil(enemy.meleeDamage * multiplier);
      enemy.weaponDamage = Math.ceil(enemy.weaponDamage * multiplier);
    });
  }
}

/**
 * WavePreset - Pre-configured difficulty levels
 */
class WavePreset {
  static readonly PRESETS = {
    'tutorial': {
      difficultyMultiplier: 0.7,
      waves: [
        { delay: 0, enemies: [{type: 'grunt', count: 1}] },
        { delay: 20, enemies: [{type: 'grunt', count: 2}] }
      ]
    },
    'easy': {
      difficultyMultiplier: 0.8,
      waves: [
        { delay: 0, enemies: [{type: 'grunt', count: 2}] },
        { delay: 30, enemies: [{type: 'grunt', count: 3}] },
        { delay: 60, enemies: [{type: 'grunt', count: 2}, {type: 'elite', count: 1}] }
      ]
    },
    'normal': {
      difficultyMultiplier: 1.0,
      waves: [
        { delay: 0, enemies: [{type: 'grunt', count: 3}] },
        { delay: 20, enemies: [{type: 'elite', count: 1}] },
        { delay: 45, enemies: [{type: 'grunt', count: 2}, {type: 'elite', count: 1}] },
        { delay: 75, enemies: [{type: 'elite', count: 2}] },
        { delay: 100, enemies: [{type: 'grunt', count: 4}, {type: 'elite', count: 1}] }
      ]
    },
    'hard': {
      difficultyMultiplier: 1.3,
      waves: [
        { delay: 0, enemies: [{type: 'elite', count: 1}, {type: 'grunt', count: 2}] },
        { delay: 15, enemies: [{type: 'elite', count: 2}] },
        { delay: 40, enemies: [{type: 'grunt', count: 3}, {type: 'elite', count: 2}] },
        { delay: 70, enemies: [{type: 'elite', count: 3}, {type: 'grunt', count: 2}] }
      ]
    },
    'legendary': {
      difficultyMultiplier: 1.5,
      waves: [
        { delay: 0, enemies: [{type: 'elite', count: 2}, {type: 'grunt', count: 3}] },
        { delay: 10, enemies: [{type: 'elite', count: 3}] },
        { delay: 35, enemies: [{type: 'elite', count: 3}, {type: 'grunt', count: 4}] },
        { delay: 65, enemies: [{type: 'elite', count: 4}, {type: 'grunt', count: 2}] }
      ]
    }
  };

  static getPreset(difficultyName) {
    return this.PRESETS[difficultyName] || this.PRESETS['normal'];
  }
}

/**
 * SpawnPointManager - Visual and functional spawn point management
 */
class SpawnPointManager {
  constructor(scene) {
    this.scene = scene;
    this.spawnPointMeshes = [];
    this.showVisualization = false;
  }

  /**
   * Add spawn point to level (include call in level.js)
   */
  registerAndVisualize(position, type = 'any', showMarker = false) {
    if (showMarker) {
      // Create visual marker (useful during level design)
      const marker = BABYLON.MeshBuilder.CreateBox('spawnMarker', { size: 1.5 }, this.scene);
      marker.position = position;

      const mat = new BABYLON.StandardMaterial('spawnMarkerMat', this.scene);
      mat.diffuse = type === 'elite' ? new BABYLON.Color3(1, 0, 0) : new BABYLON.Color3(0, 1, 0);
      mat.alpha = 0.3;
      marker.material = mat;

      this.spawnPointMeshes.push(marker);
    }

    return { position, type };
  }

  /**
   * Toggle visualization for debugging
   */
  toggleVisualization(spawner) {
    this.showVisualization = !this.showVisualization;

    this.spawnPointMeshes.forEach(mesh => {
      mesh.isVisible = this.showVisualization;
    });
  }

  /**
   * Cleanup
   */
  dispose() {
    this.spawnPointMeshes.forEach(mesh => mesh.dispose());
    this.spawnPointMeshes = [];
  }
}
