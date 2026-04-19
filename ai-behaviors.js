// ============================================================================
// AI BEHAVIORS - Advanced perception, pathfinding, and decision making
// ============================================================================

/**
 * PathfindingHelper - Navigate around obstacles
 */
class PathfindingHelper {
  constructor(scene) {
    this.scene = scene;
    this.waypoints = [];
  }

  /**
   * Find a path around obstacles using simple waypoint system
   */
  findPath(start, goal, maxDistance = 100) {
    const direct = BABYLON.Vector3.Distance(start, goal);

    // If direct path is clear, use it
    if (this.isPathClear(start, goal)) {
      return [goal];
    }

    // Otherwise, find waypoints around obstacles
    const path = [start];
    const pathLength = Math.min(direct, maxDistance);

    // Try different angles to find clear path
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const via = new BABYLON.Vector3(
        start.x + Math.cos(angle) * pathLength * 0.5,
        start.y,
        start.z + Math.sin(angle) * pathLength * 0.5
      );

      if (this.isPathClear(via, goal)) {
        path.push(via);
        path.push(goal);
        return path;
      }
    }

    // Fallback: move toward goal
    path.push(goal);
    return path;
  }

  /**
   * Check if a path between two points is clear
   */
  isPathClear(from, to) {
    const direction = BABYLON.Vector3.Normalize(to.subtract(from));
    const distance = BABYLON.Vector3.Distance(from, to);
    const ray = new BABYLON.Ray(from, direction, distance);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      // Ignore player and transparent meshes
      return mesh.name !== 'player' && mesh.visibility !== 0;
    });

    // Path is clear if no obstacle hit, or obstacle is far
    return !hit || !hit.hit || hit.distance > distance * 0.95;
  }
}

/**
 * CoverFinder - Locate cover spots in the level
 */
class CoverFinder {
  constructor(scene) {
    this.scene = scene;
    this.coverPoints = [];
    this.initialized = false;
  }

  /**
   * Scan level for cover points (static, done once)
   */
  initializeCoverPoints() {
    if (this.initialized) return;

    // Find large meshes that could provide cover
    const meshes = this.scene.meshes.filter(m => {
      return m.checkCollisions && m.name !== 'player' && !m.isDisposed();
    });

    // Extract potential cover positions from mesh bounding boxes
    meshes.forEach(mesh => {
      const bounds = mesh.getBoundingInfo().boundingBox;
      const center = bounds.center;

      // Add corner points as potential cover
      const corners = [
        center.add(new BABYLON.Vector3(bounds.extendSize.x, 0, bounds.extendSize.z)),
        center.add(new BABYLON.Vector3(-bounds.extendSize.x, 0, bounds.extendSize.z)),
        center.add(new BABYLON.Vector3(bounds.extendSize.x, 0, -bounds.extendSize.z)),
        center.add(new BABYLON.Vector3(-bounds.extendSize.x, 0, -bounds.extendSize.z))
      ];

      corners.forEach(corner => {
        this.coverPoints.push({
          position: corner,
          mesh: mesh,
          quality: 0.5 // 0-1 scale
        });
      });
    });

    this.initialized = true;
  }

  /**
   * Find nearest cover from a position
   */
  findNearestCover(fromPosition, playerPosition) {
    this.initializeCoverPoints();

    let bestCover = null;
    let bestScore = -Infinity;

    this.coverPoints.forEach(cover => {
      // Score based on: distance from enemy, protection from player
      const distFromEnemy = BABYLON.Vector3.Distance(fromPosition, cover.position);
      const distFromPlayer = BABYLON.Vector3.Distance(playerPosition, cover.position);

      // Closer to enemy is better (less effort), farther from player is better (more protected)
      const score = (distFromPlayer / (distFromEnemy + 1)) * cover.quality;

      if (score > bestScore) {
        bestScore = score;
        bestCover = cover;
      }
    });

    return bestCover ? bestCover.position : null;
  }

  /**
   * Check if a position provides cover from another position
   */
  isCoveredFrom(position, threatPosition, coverMesh) {
    const direction = BABYLON.Vector3.Normalize(position.subtract(threatPosition));
    const distance = BABYLON.Vector3.Distance(threatPosition, position);
    const ray = new BABYLON.Ray(threatPosition, direction, distance);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh === coverMesh || (mesh.checkCollisions && mesh.name !== 'player');
    });

    return hit && hit.hit;
  }
}

/**
 * TacticalAnalyzer - Evaluate strategic decisions
 */
class TacticalAnalyzer {
  /**
   * Evaluate if position is under fire
   */
  static isUnderFire(position, threats) {
    if (!threats || threats.length === 0) return false;

    // Check if any threat has line of sight
    return threats.some(threat => {
      const dirToThreat = BABYLON.Vector3.Normalize(threat.subtract(position));
      const distance = BABYLON.Vector3.Distance(position, threat);

      // Simple heuristic: within cone toward threat
      return distance < 50;
    });
  }

  /**
   * Calculate best flanking position relative to target
   */
  static calculateFlankPosition(enemyPosition, targetPosition, targetDirection, flankDistance = 25) {
    // Create perpendicular vectors (left and right of target's facing)
    const perpLeft = new BABYLON.Vector3(-targetDirection.z, 0, targetDirection.x);
    const perpRight = new BABYLON.Vector3(targetDirection.z, 0, -targetDirection.x);

    // Consider both flanking options
    const leftFlank = targetPosition.add(perpLeft.scale(flankDistance));
    const rightFlank = targetPosition.add(perpRight.scale(flankDistance));

    // Choose flank closer to enemy's current position
    const distLeft = BABYLON.Vector3.Distance(enemyPosition, leftFlank);
    const distRight = BABYLON.Vector3.Distance(enemyPosition, rightFlank);

    return distLeft < distRight ? leftFlank : rightFlank;
  }

  /**
   * Determine if grenade throw is viable
   */
  static shouldThrowGrenade(enemyPos, playerPos, playerBehindCover) {
    const distance = BABYLON.Vector3.Distance(enemyPos, playerPos);

    // Throw if player is in range and behind cover (can't just charge in)
    return distance > 8 && distance < 40 && playerBehindCover;
  }

  /**
   * Estimate grenade arc trajectory
   */
  static calculateGrenadeTrajectory(throwPosition, targetPosition, throwPower = 25) {
    const direction = BABYLON.Vector3.Normalize(targetPosition.subtract(throwPosition));
    const distance = BABYLON.Vector3.Distance(throwPosition, targetPosition);

    // Adjust angle based on distance
    const angle = distance > 20 ? Math.PI / 3 : Math.PI / 4;

    // Add upward component
    const velocity = new BABYLON.Vector3(
      direction.x * throwPower * Math.cos(angle),
      Math.sin(angle) * throwPower * 1.5,
      direction.z * throwPower * Math.cos(angle)
    );

    return velocity;
  }
}

/**
 * PerceptionHelper - Enhanced vision and hearing
 */
class PerceptionHelper {
  /**
   * Raycast-based line of sight check
   */
  static hasLineOfSight(fromPosition, toPosition, scene, maxDistance = 100) {
    const direction = BABYLON.Vector3.Normalize(toPosition.subtract(fromPosition));
    const distance = BABYLON.Vector3.Distance(fromPosition, toPosition);

    if (distance > maxDistance) return false;

    const ray = new BABYLON.Ray(fromPosition, direction, distance);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.checkCollisions && mesh.name !== 'player';
    });

    // Has LOS if nothing blocks the ray
    return !hit || !hit.hit;
  }

  /**
   * Check if sound from position is audible at listener location
   */
  static canHearSound(listenerPosition, soundPosition, hearingRange, soundType = 'normal') {
    const distance = BABYLON.Vector3.Distance(listenerPosition, soundPosition);

    // Different sounds carry different distances
    const ranges = {
      'normal': hearingRange,
      'gunfire': hearingRange * 1.5,
      'explosion': hearingRange * 2,
      'melee': hearingRange * 0.5
    };

    return distance <= (ranges[soundType] || hearingRange);
  }

  /**
   * Get noise level that affects alert state
   */
  static calculateNoiseLevel(soundType, distance, maxDistance) {
    const normalizedDist = distance / maxDistance;
    const baseLevels = {
      'normal': 0.3,
      'gunfire': 0.8,
      'explosion': 1.0,
      'melee': 0.2
    };

    const baseLevel = baseLevels[soundType] || 0.5;
    const distanceFactor = Math.max(0, 1 - normalizedDist);

    return baseLevel * distanceFactor;
  }
}

/**
 * GroupBehavior - Coordinate multiple enemies
 */
class GroupBehavior {
  /**
   * Calculate spacing between group members
   */
  static calculateGroupFormation(enemies, centerPosition, formationType = 'wedge') {
    const spacing = 4;
    const formations = {
      'line': enemies.map((e, i) => ({
        position: centerPosition.add(new BABYLON.Vector3(i * spacing - (enemies.length * spacing) / 2, 0, 0)),
        offset: i
      })),
      'wedge': enemies.map((e, i) => ({
        position: centerPosition.add(new BABYLON.Vector3(
          (i - enemies.length / 2) * spacing,
          0,
          i * spacing
        )),
        offset: i
      })),
      'circle': enemies.map((e, i) => {
        const angle = (i / enemies.length) * Math.PI * 2;
        return {
          position: centerPosition.add(new BABYLON.Vector3(
            Math.cos(angle) * spacing * 2,
            0,
            Math.sin(angle) * spacing * 2
          )),
          offset: i
        };
      })
    };

    return formations[formationType] || formations['line'];
  }

  /**
   * Avoid clustering with other enemies
   */
  static getAvoidanceVector(position, nearbyEnemies, avoidanceDistance = 3) {
    let avoidance = new BABYLON.Vector3(0, 0, 0);

    nearbyEnemies.forEach(other => {
      if (other.isDead) return;

      const toOther = other.position.subtract(position);
      const distance = toOther.length();

      if (distance < avoidanceDistance && distance > 0.01) {
        // Push away from other
        const pushBack = BABYLON.Vector3.Normalize(toOther).scale(-1 / distance);
        avoidance = avoidance.add(pushBack);
      }
    });

    return avoidance;
  }
}

/**
 * AnimationController - Manage enemy animations
 */
class AnimationController {
  /**
   * Play animation based on state
   */
  static playAnimationForState(skeleton, state, animationGroup) {
    if (!skeleton) return;

    const animationMap = {
      'PATROL': 'idle',
      'ALERT': 'search',
      'COMBAT': 'attack',
      'DEAD': 'death'
    };

    const animationName = animationMap[state] || 'idle';
    // Would call skeleton animation play here
  }

  /**
   * Smoothly blend between animations
   */
  static blendAnimation(skeleton, fromAnim, toAnim, duration = 0.3) {
    if (!skeleton) return;
    // Implementation would use Babylon's animation blending
  }
}

/**
 * DamageSystem - Handle enemy damage and effects
 */
class DamageSystem {
  /**
   * Create impact effect at position
   */
  static createImpactEffect(position, scene, color = new BABYLON.Color3(1, 1, 0)) {
    const particles = [];

    for (let i = 0; i < 5; i++) {
      const particle = BABYLON.MeshBuilder.CreateSphere('impact', { diameter: 0.2 }, scene);
      particle.position = position;

      const mat = new BABYLON.StandardMaterial('impactMat', scene);
      mat.diffuse = color;
      particle.material = mat;

      const velocity = new BABYLON.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 15,
        (Math.random() - 0.5) * 20
      );

      let lifetime = 0.5;
      const updateFunc = () => {
        lifetime -= 0.016;
        if (lifetime <= 0) {
          particle.dispose();
          return;
        }

        velocity.y -= 20 * 0.016;
        particle.position = particle.position.add(velocity.scale(0.016));
        particle.scaling = particle.scaling.scale(0.98);

        requestAnimationFrame(updateFunc);
      };

      requestAnimationFrame(updateFunc);
      particles.push(particle);
    }

    return particles;
  }

  /**
   * Create blood effect
   */
  static createBloodEffect(position, scene) {
    return this.createImpactEffect(position, scene, new BABYLON.Color3(0.8, 0, 0));
  }
}
