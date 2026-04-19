// ============================================================================
// COVENANT ENEMY AI SYSTEM - Babylon.js FPS
// Grunt and Elite archetypes with state machine (PATROL → ALERT → COMBAT)
// ============================================================================

/**
 * BaseEnemy - Abstract base class for all enemy types
 * Handles state machine, health, perception, and behavior updates
 */
class BaseEnemy {
  constructor(position, scene, type = 'grunt') {
    this.scene = scene;
    this.type = type; // 'grunt' or 'elite'

    // Transform
    this.position = position.clone();
    this.mesh = null; // Will be set when model loads
    this.skeleton = null;
    this.direction = new BABYLON.Vector3(1, 0, 0);

    // Health & Vitals
    this.maxHealth = type === 'elite' ? 50 : 10;
    this.health = this.maxHealth;
    this.isDead = false;
    this.lastDamageTime = 0;

    // State Machine
    this.state = 'PATROL'; // PATROL, ALERT, COMBAT
    this.stateTimer = 0;
    this.stateChangeThreshold = 3; // seconds to change state

    // Perception
    this.visionRange = 20; // Changes per state
    this.hearingRange = 30;
    this.fov = Math.PI / 1.5; // 120 degrees
    this.lastPlayerSeen = null;
    this.playerInSight = false;

    // Movement & Navigation
    this.velocity = new BABYLON.Vector3(0, 0, 0);
    this.targetPosition = position.clone();
    this.moveSpeed = type === 'elite' ? 8 : 12; // Grunts are faster
    this.acceleration = 25;
    this.friction = 0.95;

    // Combat
    this.targetPlayer = null;
    this.lastAttackTime = 0;
    this.attackCooldown = type === 'elite' ? 1.5 : 0.8;
    this.meleeDamage = type === 'elite' ? 25 : 8;
    this.weaponDamage = type === 'elite' ? 15 : 10;
    this.grenadeCount = type === 'elite' ? 2 : 1;

    // Flanking behavior
    this.flanking = false;
    this.flankDirection = 0; // -1 = left, 1 = right
    this.flankDistance = 25;
    this.flankTimer = 0;

    // Animation
    this.animationSpeed = 1;
    this.currentAnimation = null;
  }

  /**
   * Load the enemy mesh from GLB file
   */
  async loadModel(modelPath) {
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        modelPath.substring(0, modelPath.lastIndexOf('/') + 1),
        modelPath.substring(modelPath.lastIndexOf('/') + 1),
        this.scene
      );

      this.mesh = result.meshes[0];
      this.skeleton = result.skeletons[0];

      this.mesh.position = this.position;
      this.mesh.checkCollisions = true;
      this.mesh.moveWithCollisions = true;

      return true;
    } catch (e) {
      console.warn(`Failed to load model: ${modelPath}. Using fallback.`);
      this.createFallbackMesh();
      return false;
    }
  }

  /**
   * Create a simple geometric fallback if model fails to load
   */
  createFallbackMesh() {
    if (this.type === 'elite') {
      // Tall cylindrical shape for Elite
      this.mesh = BABYLON.MeshBuilder.CreateCylinder('elite', { height: 2.5, diameter: 1.2 }, this.scene);
      const mat = new BABYLON.StandardMaterial('eliteMat', this.scene);
      mat.diffuse = new BABYLON.Color3(0.7, 0.1, 0.1); // Red
      this.mesh.material = mat;
    } else {
      // Shorter rounded shape for Grunt
      this.mesh = BABYLON.MeshBuilder.CreateSphere('grunt', { diameter: 1.0 }, this.scene);
      const mat = new BABYLON.StandardMaterial('gruntMat', this.scene);
      mat.diffuse = new BABYLON.Color3(0.2, 0.8, 0.2); // Green
      this.mesh.material = mat;
    }

    this.mesh.position = this.position;
    this.mesh.checkCollisions = true;
    this.mesh.moveWithCollisions = true;
  }

  /**
   * Main update loop
   */
  update(deltaTime, gameState) {
    if (this.isDead || !this.mesh) return;

    // Update perception
    this.updatePerception(gameState);

    // State machine logic
    this.updateStateMachine(deltaTime, gameState);

    // Movement
    this.updateMovement(deltaTime);

    // Animation updates
    this.updateAnimation(deltaTime);
  }

  /**
   * Perceive the environment (player, sounds, etc)
   */
  updatePerception(gameState) {
    if (!gameState.player) return;

    const playerPos = gameState.player.position;
    const distToPlayer = BABYLON.Vector3.Distance(this.position, playerPos);

    // Check line of sight
    this.checkLineOfSight(playerPos, distToPlayer);

    // Update vision range based on state
    const visionRanges = {
      'PATROL': 20,
      'ALERT': 40,
      'COMBAT': 60
    };
    this.visionRange = visionRanges[this.state] || 20;

    // Can see player if in range and in FOV
    if (distToPlayer < this.visionRange) {
      const toPlayer = BABYLON.Vector3.Normalize(playerPos.subtract(this.position));
      const dotProduct = BABYLON.Vector3.Dot(this.direction, toPlayer);

      if (dotProduct > Math.cos(this.fov / 2)) {
        this.playerInSight = true;
        this.lastPlayerSeen = playerPos.clone();
      }
    }

    // Lose sight if player is far or blocked
    if (distToPlayer > this.visionRange * 1.5) {
      this.playerInSight = false;
    }
  }

  /**
   * Raycast to check if player is actually visible (not behind walls)
   */
  checkLineOfSight(targetPos, distance) {
    if (distance > this.visionRange) {
      this.playerInSight = false;
      return;
    }

    const direction = BABYLON.Vector3.Normalize(targetPos.subtract(this.position));
    const ray = new BABYLON.Ray(this.position, direction, distance);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh !== this.mesh; // Ignore self
    });

    // If ray hits something before reaching player, player is blocked
    if (hit && hit.hit && hit.distance < distance * 0.95) {
      this.playerInSight = false;
    }
  }

  /**
   * State machine transitions and behavior
   */
  updateStateMachine(deltaTime, gameState) {
    this.stateTimer += deltaTime;

    switch (this.state) {
      case 'PATROL':
        this.updatePatrolState(deltaTime, gameState);
        break;
      case 'ALERT':
        this.updateAlertState(deltaTime, gameState);
        break;
      case 'COMBAT':
        this.updateCombatState(deltaTime, gameState);
        break;
    }
  }

  /**
   * PATROL state: Wander between waypoints, look around
   */
  updatePatrolState(deltaTime, gameState) {
    // If player is seen, transition to COMBAT
    if (this.playerInSight) {
      this.state = 'ALERT';
      this.stateTimer = 0;
      return;
    }

    // Random waypoint movement
    if (this.stateTimer > 8) {
      this.targetPosition = this.position.add(
        new BABYLON.Vector3(
          (Math.random() - 0.5) * 30,
          0,
          (Math.random() - 0.5) * 30
        )
      );
      this.stateTimer = 0;
    }

    // Slow head-turning animation
    const time = Date.now() * 0.001;
    const headTurn = Math.sin(time) * 0.3;
    this.direction = BABYLON.Vector3.Normalize(
      this.targetPosition.subtract(this.position)
    );
    if (this.mesh) {
      this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z) + headTurn;
    }
  }

  /**
   * ALERT state: Search for player, gradually relax
   */
  updateAlertState(deltaTime, gameState) {
    // If player is seen, go to COMBAT
    if (this.playerInSight) {
      this.state = 'COMBAT';
      this.stateTimer = 0;
      return;
    }

    // If alert too long without seeing player, return to PATROL
    if (this.stateTimer > this.stateChangeThreshold) {
      this.state = 'PATROL';
      this.stateTimer = 0;
      return;
    }

    // Search behavior: Look around and move toward last known position
    if (this.lastPlayerSeen) {
      this.targetPosition = this.lastPlayerSeen.clone();
    }

    // Turn head while searching
    const searchTurn = Math.sin(Date.now() * 0.005) * 0.5;
    if (this.mesh) {
      this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z) + searchTurn;
    }
  }

  /**
   * COMBAT state: Attack, take cover, flank
   */
  updateCombatState(deltaTime, gameState) {
    if (!gameState.player) return;

    const playerPos = gameState.player.position;
    const distToPlayer = BABYLON.Vector3.Distance(this.position, playerPos);

    // Lose combat if player is very far or blocked for too long
    if (distToPlayer > this.visionRange * 2 && !this.playerInSight) {
      this.state = 'ALERT';
      this.stateTimer = 0;
      return;
    }

    // Face player
    const toPlayer = playerPos.subtract(this.position);
    const dirToPlayer = BABYLON.Vector3.Normalize(toPlayer);
    this.direction = dirToPlayer;

    if (this.mesh) {
      this.mesh.rotation.y = Math.atan2(dirToPlayer.x, dirToPlayer.z);
    }

    // Movement behavior
    if (distToPlayer < 5) {
      // Melee range: Attack
      this.attemptMeleeAttack(gameState);
      this.stationaryAttack();
    } else if (distToPlayer < 15) {
      // Medium range: Strafe and shoot
      this.strafeAroundPlayer(dirToPlayer);
      this.attemptRangedAttack(gameState);
    } else {
      // Long range: Advance and throw grenades
      this.moveTowardPlayer(playerPos);
      this.attemptGrenadeThrow(gameState);
    }

    // Low health: Flank aggressively
    if (this.health / this.maxHealth < 0.3) {
      this.flanking = true;
      this.performFlank(dirToPlayer);
    }
  }

  /**
   * Move toward player while strafing left/right
   */
  strafeAroundPlayer(directionToPlayer) {
    // Random strafe direction
    if (!this.flankDirection || Math.random() > 0.95) {
      this.flankDirection = Math.random() > 0.5 ? 1 : -1;
    }

    // Create perpendicular vector for strafing
    const strafe = new BABYLON.Vector3(
      -directionToPlayer.z * this.flankDirection,
      0,
      directionToPlayer.x * this.flankDirection
    );

    this.targetPosition = this.position.add(strafe.scale(8));
  }

  /**
   * Move directly toward player
   */
  moveTowardPlayer(playerPos) {
    this.targetPosition = playerPos.clone();
  }

  /**
   * Stop moving for melee attack
   */
  stationaryAttack() {
    this.targetPosition = this.position.clone();
  }

  /**
   * Flank maneuver: Circle around player at distance
   */
  performFlank(directionToPlayer) {
    const perp = new BABYLON.Vector3(
      -directionToPlayer.z,
      0,
      directionToPlayer.x
    );

    const flankPos = this.position
      .add(directionToPlayer.scale(-10))
      .add(perp.scale(this.flankDistance * (this.flankDirection || 1)));

    this.targetPosition = flankPos;
  }

  /**
   * Attempt melee attack
   */
  attemptMeleeAttack(gameState) {
    const now = performance.now();
    if (now - this.lastAttackTime < this.attackCooldown * 1000) return;

    const player = gameState.player;
    const distToPlayer = BABYLON.Vector3.Distance(this.position, player.position);

    if (distToPlayer < 3) {
      // Deal damage
      player.health.takeDamage(this.meleeDamage);
      this.lastAttackTime = now;

      // Simple punch animation
      if (this.mesh) {
        this.mesh.scaling.z = 1.2;
        setTimeout(() => { this.mesh.scaling.z = 1; }, 100);
      }
    }
  }

  /**
   * Attempt ranged attack (weapon fire)
   */
  attemptRangedAttack(gameState) {
    const now = performance.now();
    if (now - this.lastAttackTime < this.attackCooldown * 1000) return;

    const player = gameState.player;
    const distToPlayer = BABYLON.Vector3.Distance(this.position, player.position);

    if (distToPlayer < 50 && this.playerInSight) {
      // Deal damage with some inaccuracy
      const accuracy = this.type === 'elite' ? 0.85 : 0.65;
      if (Math.random() < accuracy) {
        player.health.takeDamage(this.weaponDamage);
      }
      this.lastAttackTime = now;
    }
  }

  /**
   * Throw a grenade at player if behind cover
   */
  attemptGrenadeThrow(gameState) {
    if (this.grenadeCount <= 0) return;
    if (Math.random() > 0.3) return; // 30% chance per frame

    const player = gameState.player;
    const distToPlayer = BABYLON.Vector3.Distance(this.position, player.position);

    // Only throw grenades at medium range
    if (distToPlayer > 8 && distToPlayer < 40 && this.playerInSight) {
      this.grenadeCount--;
      this.spawnGrenade(gameState.grenades, player.position);
    }
  }

  /**
   * Create a grenade projectile
   */
  spawnGrenade(grenadeArray, targetPos) {
    if (!grenadeArray) return;

    const grenade = {
      position: this.position.add(new BABYLON.Vector3(0, 1, 0)),
      velocity: new BABYLON.Vector3(0, 15, 0).add(
        BABYLON.Vector3.Normalize(targetPos.subtract(this.position)).scale(20)
      ),
      mesh: BABYLON.MeshBuilder.CreateSphere('grenade', { diameter: 0.3 }, this.scene),
      lifetime: 5,
      exploded: false,
      hasStuck: false
    };

    grenade.mesh.position = grenade.position;
    const mat = new BABYLON.StandardMaterial('grenadeMat', this.scene);
    mat.diffuse = new BABYLON.Color3(0.3, 0.3, 0.3);
    grenade.mesh.material = mat;

    grenadeArray.push(grenade);
  }

  /**
   * Update movement based on target position
   */
  updateMovement(deltaTime) {
    if (!this.mesh) return;

    const toTarget = this.targetPosition.subtract(this.position);
    const distToTarget = toTarget.length();

    if (distToTarget > 0.5) {
      const direction = BABYLON.Vector3.Normalize(toTarget);
      const desiredVelocity = direction.scale(this.moveSpeed);

      // Smooth acceleration
      this.velocity = BABYLON.Vector3.Lerp(
        this.velocity,
        desiredVelocity,
        Math.min(1, this.acceleration * deltaTime)
      );
    } else {
      // Apply friction when near target
      this.velocity = this.velocity.scale(this.friction);
    }

    // Apply gravity
    this.velocity.y -= 20 * deltaTime;

    // Update position with collision
    if (this.mesh.moveWithCollisions !== false) {
      this.position = this.position.add(this.velocity.scale(deltaTime));
      this.mesh.position = this.position;
    }
  }

  /**
   * Update animation playback
   */
  updateAnimation(deltaTime) {
    if (!this.skeleton) return;

    // Simple animation speed based on movement
    const speed = this.velocity.length();
    this.animationSpeed = Math.min(2, speed / this.moveSpeed);
  }

  /**
   * Take damage
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.lastDamageTime = performance.now();

    if (this.health <= 0) {
      this.die();
    }
  }

  /**
   * Die
   */
  die() {
    this.isDead = true;
    this.state = 'DEAD';

    // Play enemy death sound
    if (window.soundSystem) window.soundSystem.playEnemyDeath();

    // Capture death position before mesh fades
    const deathPos = this.position.clone();
    const enemyType = this.type;
    const scene = this.scene;

    // Fade out mesh then spawn a weapon pickup at death position
    if (this.mesh) {
      let opacity = 1;
      const fadeInterval = setInterval(() => {
        opacity -= 0.05;
        if (this.mesh && this.mesh.material) {
          this.mesh.material.alpha = opacity;
        }
        if (opacity <= 0) {
          clearInterval(fadeInterval);
          if (this.mesh) this.mesh.dispose();

          // Spawn weapon pickup crate
          window.weaponPickups = window.weaponPickups || [];

          const pickupMesh = BABYLON.MeshBuilder.CreateCylinder(
            'weaponPickup',
            { height: 0.25, diameter: 0.9 },
            scene
          );
          pickupMesh.position = deathPos.clone();
          pickupMesh.position.y = Math.max(pickupMesh.position.y, 0.15);

          const pickupMat = new BABYLON.StandardMaterial('pickupMat', scene);
          pickupMat.emissiveColor = new BABYLON.Color3(1, 0.85, 0);
          pickupMat.alpha = 1;
          pickupMesh.material = pickupMat;

          // Pickup data
          pickupMesh.weaponType = (enemyType === 'elite') ? 'pistol' : 'rifle';
          pickupMesh.ammoAmount = (enemyType === 'elite') ? 24 : 60;
          pickupMesh._bobOriginY = pickupMesh.position.y;
          pickupMesh._bobTime = Math.random() * Math.PI * 2; // random phase

          window.weaponPickups.push(pickupMesh);
        }
      }, 50);
    }
  }
}

/**
 * Grunt - Fast, weak ranged combatant
 */
class Grunt extends BaseEnemy {
  constructor(position, scene) {
    super(position, scene, 'grunt');
    this.maxHealth = 10;
    this.health = this.maxHealth;
    this.moveSpeed = 12;
    this.meleeDamage = 8;
    this.weaponDamage = 10;
    this.grenadeCount = 1;
  }
}

/**
 * Elite - Strong, tactical melee/ranged hybrid
 */
class Elite extends BaseEnemy {
  constructor(position, scene) {
    super(position, scene, 'elite');
    this.maxHealth = 50;
    this.health = this.maxHealth;
    this.moveSpeed = 8; // Slower but more armored
    this.meleeDamage = 25;
    this.weaponDamage = 15;
    this.grenadeCount = 2;
    this.hasShield = true;
    this.shieldHealth = 25;
  }

  takeDamage(amount) {
    // Elite shields block some damage
    if (this.hasShield && this.shieldHealth > 0) {
      const shieldAbsorb = Math.min(this.shieldHealth, amount * 0.6);
      this.shieldHealth -= shieldAbsorb;
      amount -= shieldAbsorb;

      if (this.shieldHealth <= 0) {
        this.hasShield = false;
      }
    }

    super.takeDamage(amount);
  }
}
