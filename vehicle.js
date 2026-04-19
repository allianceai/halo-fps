// ============================================================================
// WARTHOG VEHICLE SYSTEM — Halo CE Inspired
// Babylon.js — procedural geometry only, no external assets required
//
// Physics model: fully manual kinematic (no Ammo.js / Havok / CannonJS needed)
//   - Vehicle state: position, velocity, heading angle, angular velocity
//   - Suspension: 4 per-frame downward raycasts → spring height + contact normal
//   - Drive: rear-wheel thrust along heading
//   - Steering: yaw torque scaled by speed
//   - Lateral friction: sideslip correction each frame
//
// Seat layout (Halo CE Warthog):
//   Seat 0 = DRIVER     WASD = throttle/steer, SPACE = handbrake
//   Seat 1 = PASSENGER  Mouse = turret yaw/pitch, LMB = chain-gun fire
//
// Controls summary:
//   F         — enter / exit (nearest vehicle; driver first, gunner fallback)
//   TAB       — swap driver ↔ gunner seat (while in vehicle)
//   WASD      — drive (driver only)
//   SPACE     — handbrake (driver)
//   Mouse     — turret aim (gunner) / camera look (driver handled by game.js)
//   LMB       — chain-gun fire (gunner)
// ============================================================================

'use strict';

// ============================================================================
// CONFIG
// ============================================================================
const WARTHOG_CFG = {
  // chassis dimensions
  chassisW: 3.2,
  chassisH: 0.88,
  chassisD: 5.2,

  // driving
  maxSpeed:          26,   // m/s top speed
  acceleration:      22,   // m/s² max
  brakeDecel:        34,   // m/s² braking decel
  rollingFriction:   0.96, // velocity multiplier per frame (< 1 = drag)
  lateralFriction:   0.78, // sideslip correction strength (0–1)
  maxSteerAngle:     0.55, // radians (≈31°)
  steerSpeed:        2.0,  // rad/s steer rate
  steerReturnSpeed:  3.5,  // rad/s wheel straighten rate
  turnRate:          1.15, // rad/s max yaw rate at full speed/steer
  turnSpeedScale:    0.055,// how much speed amplifies turning

  // suspension (visual spring for wheels)
  wheelRadius:       0.58,
  wheelWidth:        0.40,
  suspRestLen:       0.82,
  suspMaxTravel:     0.52,
  suspStiffness:     18,   // spring constant (pixel/s² per unit compression) — visual only
  suspDamping:       7,
  wheelOffsets: [   // local XZ from chassis centre
    { x: -1.68, z: -1.82 },  // FL
    { x:  1.68, z: -1.82 },  // FR
    { x: -1.68, z:  1.72 },  // RL
    { x:  1.68, z:  1.72 },  // RR
  ],

  // enter/exit
  enterRadius:       6.5,
  exitSideOffset:    2.8,

  // turret
  turretYawSpeed:    2.0,   // rad/s keyboard, multiplied for mouse
  turretPitchMin:   -0.22,
  turretPitchMax:    0.68,
  gunFireRate:       12,    // rps
  gunDamage:         18,
  tracerMaxLen:      9.0,
  tracerLifetime:    0.30,
};

// ============================================================================
// Helpers
// ============================================================================
function v3(x, y, z) { return new BABYLON.Vector3(x, y, z); }

function worldFromLocal(pos, rotY, localX, localY, localZ) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  return new BABYLON.Vector3(
    pos.x + cos * localX + sin * localZ,
    pos.y + localY,
    pos.z - sin * localX + cos * localZ
  );
}

// ============================================================================
// WarthogTurret
// ============================================================================
class WarthogTurret {
  constructor(scene) {
    this.scene    = scene;
    this.yaw      = 0;   // relative to chassis heading
    this.pitch    = 0.1;
    this.lastFire = 0;
    this.tracers  = [];

    this._build();
  }

  _build() {
    const s   = this.scene;
    const cfg = WARTHOG_CFG;

    const matDark = new BABYLON.StandardMaterial('turretMat', s);
    matDark.diffuseColor  = new BABYLON.Color3(0.16, 0.16, 0.14);
    matDark.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    matDark.specularPower = 64;

    const matBarrel = new BABYLON.StandardMaterial('barrelMat', s);
    matBarrel.diffuseColor  = new BABYLON.Color3(0.10, 0.10, 0.08);
    matBarrel.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    // Root pivot — moves with chassis
    this.root = new BABYLON.TransformNode('turretRoot', s);

    // Yaw pivot
    this.yawPivot = new BABYLON.TransformNode('turretYaw', s);
    this.yawPivot.parent = this.root;

    // Pedestal
    const ped = BABYLON.MeshBuilder.CreateCylinder('turretPed', {
      height: 0.52, diameter: 0.82, tessellation: 10
    }, s);
    ped.material = matDark;
    ped.parent   = this.yawPivot;
    ped.position.y = 0;
    ped.isPickable = false;

    // Body box
    const body = BABYLON.MeshBuilder.CreateBox('turretBody', {
      width: 0.88, height: 0.42, depth: 1.05
    }, s);
    body.material = matDark;
    body.parent   = this.yawPivot;
    body.position.y = 0.46;
    body.isPickable = false;

    // Gun shield
    const shield = BABYLON.MeshBuilder.CreateBox('turretShield', {
      width: 1.08, height: 0.60, depth: 0.10
    }, s);
    shield.material = matDark;
    shield.parent   = this.yawPivot;
    shield.position.set(0, 0.56, 0.20);
    shield.isPickable = false;

    // Pitch pivot (attached to yaw, offset to gun mount height)
    this.pitchPivot = new BABYLON.TransformNode('turretPitch', s);
    this.pitchPivot.parent   = this.yawPivot;
    this.pitchPivot.position.y = 0.46;

    // Dual barrels
    this.barrels = [];
    [-0.17, 0.17].forEach((xo, i) => {
      const b = BABYLON.MeshBuilder.CreateCylinder('barrel_' + i, {
        height: 1.72, diameter: 0.11, tessellation: 7
      }, s);
      b.rotation.x = Math.PI / 2;  // point forward
      b.material   = matBarrel;
      b.parent     = this.pitchPivot;
      b.position.set(xo, 0.02, 0.86);
      b.isPickable = false;
      this.barrels.push(b);
    });

    this._allMeshes = [ped, body, shield, ...this.barrels];
  }

  // Place turret in world each frame
  attachToVehicle(chassisPos, chassisRotY) {
    // root moves to chassis + mount offset
    const mountPos = worldFromLocal(chassisPos, chassisRotY, 0, WARTHOG_CFG.chassisH / 2 + 1.08, 1.12);
    this.root.position.copyFrom(mountPos);
    this.root.rotation.y = chassisRotY;

    // yaw pivot = chassis heading + relative turret yaw
    this.yawPivot.rotation.y = this.yaw;

    // pitch pivot
    this.pitchPivot.rotation.x = -this.pitch;
  }

  update(deltaTime, mouseDX, mouseDY, firing) {
    const cfg = WARTHOG_CFG;
    this.yaw   -= mouseDX * 0.0018;
    this.pitch -= mouseDY * 0.0018;
    this.pitch  = Math.max(cfg.turretPitchMin, Math.min(cfg.turretPitchMax, this.pitch));

    const now = performance.now() / 1000;
    if (firing && (now - this.lastFire) >= 1 / cfg.gunFireRate) {
      this.lastFire = now;
      this._fireRound();
    }

    this._updateTracers(deltaTime);
  }

  _getMuzzleWorldPos() {
    // Average of the two barrel tips in world space
    const tips = this.barrels.map(b => {
      const mat = b.getWorldMatrix();
      return BABYLON.Vector3.TransformCoordinates(v3(0, 0, 0.86), mat);
    });
    return BABYLON.Vector3.Lerp(tips[0], tips[1], 0.5);
  }

  _getFireDir() {
    // Forward direction of the pitch pivot
    const mat = this.pitchPivot.getWorldMatrix();
    return BABYLON.Vector3.TransformNormal(v3(0, 0, 1), mat).normalize();
  }

  _fireRound() {
    const scene   = this.scene;
    const origin  = this._getMuzzleWorldPos();
    const dir     = this._getFireDir();

    // Instant-hit raycast
    const ray = new BABYLON.Ray(origin, dir, 220);
    const hit = scene.pickWithRay(ray, (m) =>
      m.isPickable &&
      !m.name.startsWith('turret') &&
      !m.name.startsWith('barrel') &&
      !m.name.startsWith('tracer') &&
      !m.name.startsWith('muzzle') &&
      !m.name.startsWith('warthog') &&
      !m.name.startsWith('impact')
    );

    const endpoint = (hit && hit.hit && hit.pickedPoint)
      ? hit.pickedPoint.clone()
      : origin.add(dir.scale(220));

    // --- Tracer visual ---
    const tLen = Math.min(BABYLON.Vector3.Distance(origin, endpoint), WARTHOG_CFG.tracerMaxLen);
    if (tLen > 0.1) {
      const tracer = BABYLON.MeshBuilder.CreateCylinder('tracer', {
        height: tLen, diameter: 0.055, tessellation: 4
      }, scene);
      tracer.isPickable = false;

      // Orient along fire direction
      const up   = v3(0, 1, 0);
      const axis = BABYLON.Vector3.Cross(up, dir);
      const angle = Math.acos(Math.max(-1, Math.min(1, BABYLON.Vector3.Dot(up, dir))));
      if (axis.length() > 0.001) {
        tracer.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
      }
      tracer.position.copyFrom(BABYLON.Vector3.Lerp(origin, endpoint, 0.5));

      const tMat = new BABYLON.StandardMaterial('tracerM_' + Date.now(), scene);
      tMat.emissiveColor   = new BABYLON.Color3(1.0, 0.88, 0.3);
      tMat.disableLighting = true;
      tracer.material = tMat;

      this.tracers.push({ mesh: tracer, age: 0 });
    }

    // --- Muzzle flash ---
    const mf = BABYLON.MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.48, segments: 4 }, scene);
    mf.position.copyFrom(origin);
    mf.isPickable = false;
    const mfMat = new BABYLON.StandardMaterial('mfMat', scene);
    mfMat.emissiveColor   = new BABYLON.Color3(1, 0.72, 0.1);
    mfMat.disableLighting = true;
    mf.material = mfMat;
    setTimeout(() => { if (!mf.isDisposed()) mf.dispose(); }, 55);

    // --- Impact spark ---
    if (hit && hit.hit && hit.pickedPoint) {
      const spark = BABYLON.MeshBuilder.CreateSphere('impact', { diameter: 0.3, segments: 4 }, scene);
      spark.position.copyFrom(hit.pickedPoint);
      spark.isPickable = false;
      const spMat = new BABYLON.StandardMaterial('spMat', scene);
      spMat.emissiveColor   = new BABYLON.Color3(1, 0.55, 0.1);
      spMat.disableLighting = true;
      spark.material = spMat;
      setTimeout(() => { if (!spark.isDisposed()) spark.dispose(); }, 75);
    }
  }

  _updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += dt;
      const alpha = 1 - t.age / WARTHOG_CFG.tracerLifetime;
      if (alpha <= 0) {
        if (!t.mesh.isDisposed()) t.mesh.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mesh.material.emissiveColor = new BABYLON.Color3(alpha, alpha * 0.88, alpha * 0.3);
      }
    }
  }

  dispose() {
    this.tracers.forEach(t => { if (!t.mesh.isDisposed()) t.mesh.dispose(); });
    this._allMeshes.forEach(m => { if (!m.isDisposed()) m.dispose(); });
    this.pitchPivot.dispose();
    this.yawPivot.dispose();
    this.root.dispose();
  }
}

// ============================================================================
// Warthog
// ============================================================================
class Warthog {
  /**
   * @param {BABYLON.Scene} scene
   * @param {BABYLON.Vector3} spawnPos  world position to spawn at
   * @param {Function} getGroundY       function(pos) -> world Y of ground below pos
   */
  constructor(scene, spawnPos, getGroundY) {
    this.scene      = scene;
    this.getGroundY = getGroundY;

    // Kinematic state
    this.pos     = spawnPos.clone();   // world position of chassis centre
    this.vel     = BABYLON.Vector3.Zero(); // world velocity m/s
    this.rotY    = 0;                  // chassis heading (radians, Y up)
    this.yawRate = 0;                  // current angular velocity rad/s

    // Per-wheel spring compression for visual suspension
    this.suspComp = [0, 0, 0, 0];

    // Occupants
    this.seats = [null, null]; // null = empty; 'player' = occupied

    // Driver input (set externally by VehicleSystem each frame)
    this.throttle  = 0;   // -1 to 1
    this.steer     = 0;   // -1 to 1 (negative = left)
    this.handbrake = false;

    // Passenger turret input
    this.turretMouseDX = 0;
    this.turretMouseDY = 0;
    this.turretFiring  = false;

    this._buildMesh();
    this.turret = new WarthogTurret(scene);
  }

  // ---------------------------------------------------------------------------
  _buildMesh() {
    const s   = this.scene;
    const cfg = WARTHOG_CFG;

    // --- Materials ---
    const matBody = new BABYLON.StandardMaterial('wbody', s);
    matBody.diffuseColor  = new BABYLON.Color3(0.44, 0.48, 0.33); // olive drab
    matBody.specularColor = new BABYLON.Color3(0.12, 0.12, 0.08);
    matBody.specularPower = 28;

    const matDark = new BABYLON.StandardMaterial('wdark', s);
    matDark.diffuseColor  = new BABYLON.Color3(0.20, 0.20, 0.17);
    matDark.specularColor = new BABYLON.Color3(0.08, 0.08, 0.06);

    const matTire = new BABYLON.StandardMaterial('wtire', s);
    matTire.diffuseColor  = new BABYLON.Color3(0.10, 0.10, 0.10);
    matTire.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);

    const matRim = new BABYLON.StandardMaterial('wrim', s);
    matRim.diffuseColor  = new BABYLON.Color3(0.60, 0.56, 0.46);
    matRim.specularColor = new BABYLON.Color3(0.4, 0.4, 0.3);
    matRim.specularPower = 48;

    const matGlass = new BABYLON.StandardMaterial('wglass', s);
    matGlass.diffuseColor  = new BABYLON.Color3(0.38, 0.52, 0.68);
    matGlass.alpha         = 0.42;
    matGlass.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    matGlass.specularPower = 128;
    matGlass.backFaceCulling = false;

    const matLight = new BABYLON.StandardMaterial('wlight', s);
    matLight.emissiveColor   = new BABYLON.Color3(1.0, 0.94, 0.68);
    matLight.disableLighting = true;

    const matTailLight = new BABYLON.StandardMaterial('wtaillight', s);
    matTailLight.emissiveColor   = new BABYLON.Color3(0.9, 0.08, 0.08);
    matTailLight.disableLighting = true;

    // --- Root transform node — everything parents to this ---
    this.root = new BABYLON.TransformNode('warthogRoot', s);

    // Chassis box
    this.chassis = BABYLON.MeshBuilder.CreateBox('warthogChassis', {
      width: cfg.chassisW, height: cfg.chassisH, depth: cfg.chassisD
    }, s);
    this.chassis.material  = matBody;
    this.chassis.parent    = this.root;
    this.chassis.isPickable = false;

    // Underbody / skid plate
    const skid = BABYLON.MeshBuilder.CreateBox('wSkid', {
      width: cfg.chassisW - 0.1, height: 0.20, depth: cfg.chassisD - 0.2
    }, s);
    skid.material = matDark;
    skid.parent   = this.root;
    skid.position.y = -(cfg.chassisH / 2 + 0.08);
    skid.isPickable = false;

    // Front bumper
    const bumpF = BABYLON.MeshBuilder.CreateBox('wBumpF', {
      width: cfg.chassisW + 0.08, height: 0.36, depth: 0.40
    }, s);
    bumpF.material = matDark;
    bumpF.parent   = this.root;
    bumpF.position.set(0, -0.18, -(cfg.chassisD / 2 + 0.18));
    bumpF.isPickable = false;

    // Rear bumper
    const bumpR = BABYLON.MeshBuilder.CreateBox('wBumpR', {
      width: cfg.chassisW + 0.08, height: 0.33, depth: 0.36
    }, s);
    bumpR.material = matDark;
    bumpR.parent   = this.root;
    bumpR.position.set(0, -0.19, cfg.chassisD / 2 + 0.16);
    bumpR.isPickable = false;

    // Cab (passenger compartment)
    const cab = BABYLON.MeshBuilder.CreateBox('wCab', {
      width: cfg.chassisW - 0.22, height: 1.0, depth: 2.15
    }, s);
    cab.material = matBody;
    cab.parent   = this.root;
    cab.position.set(0, cfg.chassisH / 2 + 0.46, -0.28);
    cab.isPickable = false;

    // Windscreen
    const wind = BABYLON.MeshBuilder.CreateBox('wWind', {
      width: cfg.chassisW - 0.42, height: 0.70, depth: 0.08
    }, s);
    wind.material  = matGlass;
    wind.parent    = this.root;
    wind.position.set(0, cfg.chassisH / 2 + 0.96, -1.18);
    wind.rotation.x = -0.30;
    wind.isPickable = false;

    // Roll cage — two vertical side bars
    [-1, 1].forEach((side, i) => {
      const bar = BABYLON.MeshBuilder.CreateCylinder('wRollBar_' + i, {
        height: 1.58, diameter: 0.09, tessellation: 6
      }, s);
      bar.material = matDark;
      bar.parent   = this.root;
      bar.position.set(side * (cfg.chassisW / 2 - 0.10), cfg.chassisH / 2 + 1.22, 0.30);
      bar.isPickable = false;
    });
    // Top cross bar
    const topBar = BABYLON.MeshBuilder.CreateBox('wTopBar', {
      width: cfg.chassisW - 0.18, height: 0.09, depth: 0.09
    }, s);
    topBar.material = matDark;
    topBar.parent   = this.root;
    topBar.position.set(0, cfg.chassisH / 2 + 2.02, 0.30);
    topBar.isPickable = false;

    // Headlights (pair)
    [-0.78, 0.78].forEach((xo, i) => {
      const hl = BABYLON.MeshBuilder.CreateSphere('wHL_' + i, {
        diameter: 0.28, segments: 5
      }, s);
      hl.scaling.z = 0.4;
      hl.material  = matLight;
      hl.parent    = this.root;
      hl.position.set(xo, -0.06, -(cfg.chassisD / 2 + 0.04));
      hl.isPickable = false;
    });

    // Tail lights
    [-0.78, 0.78].forEach((xo, i) => {
      const tl = BABYLON.MeshBuilder.CreateSphere('wTL_' + i, {
        diameter: 0.22, segments: 4
      }, s);
      tl.scaling.z = 0.4;
      tl.material  = matTailLight;
      tl.parent    = this.root;
      tl.position.set(xo, -0.06, cfg.chassisD / 2 + 0.04);
      tl.isPickable = false;
    });

    // Gunner bed (rear open tray)
    const bed = BABYLON.MeshBuilder.CreateBox('wBed', {
      width: cfg.chassisW - 0.14, height: 0.52, depth: 1.50
    }, s);
    bed.material = matDark;
    bed.parent   = this.root;
    bed.position.set(0, cfg.chassisH / 2 + 0.20, cfg.chassisD / 2 - 0.88);
    bed.isPickable = false;

    // Spare tire (rear detail)
    const spare = BABYLON.MeshBuilder.CreateCylinder('wSpare', {
      height: cfg.wheelWidth + 0.05,
      diameter: cfg.wheelRadius * 2,
      tessellation: 10
    }, s);
    spare.rotation.x = Math.PI / 2;
    spare.material   = matTire;
    spare.parent     = this.root;
    spare.position.set(0, cfg.chassisH / 2 + 0.05, cfg.chassisD / 2 + 0.55);
    spare.isPickable = false;

    // Hood scoop
    const scoop = BABYLON.MeshBuilder.CreateBox('wScoop', {
      width: 0.88, height: 0.20, depth: 0.62
    }, s);
    scoop.material = matDark;
    scoop.parent   = this.root;
    scoop.position.set(0, cfg.chassisH / 2 + 0.08, -(cfg.chassisD / 2 - 1.1));
    scoop.isPickable = false;

    // --- Wheels (4): tire cylinder + rim disc ---
    this.wheelNodes = [];
    cfg.wheelOffsets.forEach((off, i) => {
      const wheelRoot = new BABYLON.TransformNode('wWheel_' + i, s);
      wheelRoot.parent = this.root;

      const tire = BABYLON.MeshBuilder.CreateCylinder('wTire_' + i, {
        height: cfg.wheelWidth + 0.08,
        diameter: cfg.wheelRadius * 2,
        tessellation: 14
      }, s);
      tire.rotation.z  = Math.PI / 2;  // X-axis spin
      tire.material    = matTire;
      tire.parent      = wheelRoot;
      tire.isPickable  = false;

      const rim = BABYLON.MeshBuilder.CreateCylinder('wRim_' + i, {
        height: cfg.wheelWidth + 0.02,
        diameter: cfg.wheelRadius * 1.18,
        tessellation: 8
      }, s);
      rim.rotation.z  = Math.PI / 2;
      rim.material    = matRim;
      rim.parent      = wheelRoot;
      rim.isPickable  = false;

      this.wheelNodes.push(wheelRoot);
    });

    // Collect all body meshes
    this._bodyMeshes = [
      this.chassis, skid, bumpF, bumpR, cab, wind,
      topBar, scoop, bed, spare
    ];
  }

  // ---------------------------------------------------------------------------
  // Seat helpers
  isDriverFree()    { return this.seats[0] === null; }
  isPassengerFree() { return this.seats[1] === null; }
  isAnyOccupied()   { return this.seats[0] !== null || this.seats[1] !== null; }

  enterSeat(i) {
    if (this.seats[i] !== null) return false;
    this.seats[i] = 'player';
    return true;
  }
  exitSeat(i) { this.seats[i] = null; }

  // World position of exit (left of driver, right of gunner)
  exitPosition(seatIndex) {
    const side = seatIndex === 0 ? -1 : 1;
    return worldFromLocal(
      this.pos, this.rotY,
      side * (WARTHOG_CFG.chassisW / 2 + WARTHOG_CFG.exitSideOffset),
      1.2, 0
    );
  }

  // Seat position for camera snap
  seatPosition(seatIndex) {
    const cfg = WARTHOG_CFG;
    if (seatIndex === 0) {
      // driver — forward-left
      return worldFromLocal(this.pos, this.rotY, -0.65, cfg.chassisH / 2 + 0.92, -0.58);
    } else {
      // gunner — centre-rear, standing in bed
      return worldFromLocal(this.pos, this.rotY, 0, cfg.chassisH / 2 + 1.28, 1.15);
    }
  }

  // ---------------------------------------------------------------------------
  // Physics + animation update
  // ---------------------------------------------------------------------------
  update(dt) {
    const cfg = WARTHOG_CFG;

    // ---- 1. Suspension raycasts — find ground contact for each wheel ----
    const groundContacts = [];
    cfg.wheelOffsets.forEach((off, i) => {
      const attachPt = worldFromLocal(this.pos, this.rotY, off.x, 0, off.z);
      const rayOrigin = attachPt.clone();
      rayOrigin.y += cfg.wheelRadius + 0.1;
      const ray = new BABYLON.Ray(rayOrigin, v3(0, -1, 0),
                                   cfg.suspRestLen + cfg.wheelRadius + cfg.suspMaxTravel + 0.1);

      const hit = this.scene.pickWithRay(ray, (m) =>
        m.checkCollisions &&
        !m.name.startsWith('warthog') && !m.name.startsWith('wbody') &&
        !m.name.startsWith('wCab') && !m.name.startsWith('wTire') &&
        !m.name.startsWith('wRim') && !m.name.startsWith('wWheel') &&
        !m.name.startsWith('wBump') && !m.name.startsWith('wBed') &&
        !m.name.startsWith('turret') && !m.name.startsWith('barrel') &&
        !m.name.startsWith('tracer') && !m.name.startsWith('muzzle')
      );

      let contact = null;
      if (hit && hit.hit && hit.pickedPoint) {
        const compression = Math.max(0,
          (rayOrigin.y - cfg.wheelRadius) - hit.pickedPoint.y
        );
        const clampedComp = Math.min(compression, cfg.suspRestLen + cfg.suspMaxTravel);
        contact = { groundY: hit.pickedPoint.y, compression: clampedComp };
      }
      groundContacts.push(contact);

      // ---- Spring visual ----
      const target = contact ? contact.compression : 0;
      const diff   = target - this.suspComp[i];
      this.suspComp[i] += diff * Math.min(cfg.suspStiffness * dt, 1.0);
    });

    const wheelsOnGround = groundContacts.filter(c => c !== null).length;
    const onGround = wheelsOnGround >= 2;

    // ---- 2. Chassis height from suspension average ----
    if (onGround) {
      // Average ground Y of all contacting wheels, then lift chassis
      let sumGroundY = 0, count = 0;
      groundContacts.forEach((c, i) => {
        if (c) {
          const attachY = c.groundY + cfg.suspRestLen - this.suspComp[i];
          sumGroundY += attachY;
          count++;
        }
      });
      const targetY = (sumGroundY / count) + cfg.chassisH / 2 + 0.04;
      // Smooth vertical position
      const yErr = targetY - this.pos.y;
      this.vel.y += yErr * 18 * dt;
      // Dampen vertical oscillation
      this.vel.y *= Math.pow(0.55, dt * 60);
    } else {
      // Airborne — gravity
      this.vel.y -= 20 * dt;
    }

    // ---- 3. Drive force (rear-wheel, along heading) ----
    const cos = Math.cos(this.rotY);
    const sin = Math.sin(this.rotY);
    const fwdX = -sin;
    const fwdZ =  cos;

    if (onGround) {
      const currentSpeedFwd = this.vel.x * fwdX + this.vel.z * fwdZ;

      if (!this.handbrake) {
        if (this.throttle !== 0) {
          // Throttle
          const targetSpeed = this.throttle * cfg.maxSpeed;
          const speedDiff   = targetSpeed - currentSpeedFwd;
          const force       = Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), cfg.acceleration * dt);
          this.vel.x += force * fwdX;
          this.vel.z += force * fwdZ;
        } else {
          // Rolling friction
          this.vel.x *= Math.pow(cfg.rollingFriction, dt * 60);
          this.vel.z *= Math.pow(cfg.rollingFriction, dt * 60);
        }
      } else {
        // Handbrake — aggressive decel
        const brake = cfg.brakeDecel * dt;
        const spd   = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
        if (spd > 0.1) {
          const scale = Math.max(0, spd - brake) / spd;
          this.vel.x *= scale;
          this.vel.z *= scale;
        } else {
          this.vel.x = 0;
          this.vel.z = 0;
        }
      }

      // Lateral friction (prevent sideways sliding)
      const rightX = cos;
      const rightZ = sin;
      const lateralSpeed = this.vel.x * rightX + this.vel.z * rightZ;
      this.vel.x -= lateralSpeed * cfg.lateralFriction * rightX;
      this.vel.z -= lateralSpeed * cfg.lateralFriction * rightZ;

      // Clamp to max speed
      const horizSpd = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
      if (horizSpd > cfg.maxSpeed) {
        const sc = cfg.maxSpeed / horizSpd;
        this.vel.x *= sc;
        this.vel.z *= sc;
      }

      // ---- 4. Steering yaw ----
      const fwdSpeed  = Math.abs(currentSpeedFwd);
      const steerEffect = fwdSpeed * cfg.turnSpeedScale;  // more speed = more turn
      const maxYawRate  = cfg.turnRate * Math.min(1, steerEffect);
      const targetYaw   = this.steer * maxYawRate;
      const yawDiff     = targetYaw - this.yawRate;
      this.yawRate += yawDiff * Math.min(8 * dt, 1);
      // If moving backwards, flip steer
      const dir = Math.sign(currentSpeedFwd) || 1;
      this.rotY += this.yawRate * dir * dt;

    } else {
      // Airborne — dampen lateral
      this.vel.x *= Math.pow(0.92, dt * 60);
      this.vel.z *= Math.pow(0.92, dt * 60);
      this.yawRate *= Math.pow(0.80, dt * 60);
    }

    // ---- 5. Integrate position ----
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // Safety: never fall below terrain
    const terrainFloor = this.getGroundY(this.pos) + cfg.chassisH / 2;
    if (this.pos.y < terrainFloor) {
      this.pos.y = terrainFloor;
      if (this.vel.y < 0) this.vel.y = 0;
    }

    // ---- 6. Update root transform ----
    this.root.position.copyFrom(this.pos);
    this.root.rotation.y = this.rotY;

    // Slight chassis tilt based on acceleration (visual flavour)
    const accelZ = (this.vel.x * fwdX + this.vel.z * fwdZ);  // approx
    this.root.rotation.x = accelZ * -0.003;

    // ---- 7. Wheel meshes ----
    const horizSpeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    const spinRate   = horizSpeed / cfg.wheelRadius;
    const spinDir    = (this.vel.x * fwdX + this.vel.z * fwdZ) >= 0 ? 1 : -1;

    cfg.wheelOffsets.forEach((off, i) => {
      const wn = this.wheelNodes[i];
      const suspY = -(cfg.suspRestLen - this.suspComp[i]);
      wn.position.set(off.x, suspY, off.z);

      // Steer front wheels
      const steerRot = (i < 2) ? this.steer * cfg.maxSteerAngle : 0;
      wn.rotation.y  = steerRot;

      // Spin (accumulate on children — use the tire mesh)
      const tire = wn.getChildMeshes(false).find(m => m.name.startsWith('wTire'));
      if (tire) {
        if (!tire._spinAngle) tire._spinAngle = 0;
        tire._spinAngle += spinRate * spinDir * dt;
        // tire is rotated z=PI/2 so "forward spin" is rotation.y of the wheelNode
        // We add spin as rotation on the wheel root's Y (which maps to tire X-axis spin)
        wn.rotation.x = tire._spinAngle;
      }
    });

    // ---- 8. Update turret ----
    if (this.seats[1] !== null) {
      this.turret.update(dt, this.turretMouseDX, this.turretMouseDY, this.turretFiring);
    }
    this.turret.attachToVehicle(this.pos, this.rotY);

    // Reset per-frame turret inputs
    this.turretMouseDX = 0;
    this.turretMouseDY = 0;
  }

  dispose() {
    this.turret.dispose();
    this.wheelNodes.forEach(wn => {
      wn.getChildMeshes().forEach(m => m.dispose());
      wn.dispose();
    });
    this._bodyMeshes.forEach(m => { if (!m.isDisposed()) m.dispose(); });
    // Dispose other children (roll bars, headlights, etc.)
    this.root.getChildMeshes().forEach(m => { if (!m.isDisposed()) m.dispose(); });
    this.root.dispose();
  }
}

// ============================================================================
// VehicleHUD
// ============================================================================
class VehicleHUD {
  constructor() {
    // "Press F" prompt near bottom-centre
    this.enterPrompt = this._el('vehicleEnterPrompt', {
      bottom: '22%', left: '50%', transform: 'translateX(-50%)',
      fontSize: '15px', fontWeight: 'bold',
      color: '#ffe066', textShadow: '0 0 12px rgba(255,224,80,0.85)',
      background: 'rgba(0,0,0,0.58)', padding: '7px 18px',
      border: '1px solid rgba(255,220,70,0.38)', borderRadius: '4px',
    }, 'PRESS F TO ENTER WARTHOG');

    // In-vehicle status bar (top-right)
    this.vehicleBar = this._el('vehicleBar', {
      top: '20px', right: '20px',
      fontSize: '12px', lineHeight: '1.75',
      color: '#ffe066', textShadow: '0 0 8px rgba(255,220,80,0.6)',
      background: 'rgba(0,0,0,0.62)', padding: '8px 14px',
      border: '1px solid rgba(255,220,70,0.32)', borderRadius: '4px',
    }, '');

    // Seat-swap hint
    this.swapHint = this._el('vehicleSwapHint', {
      bottom: '15%', left: '50%', transform: 'translateX(-50%)',
      fontSize: '12px', color: '#aaddff',
      textShadow: '0 0 8px rgba(100,180,255,0.6)',
      background: 'rgba(0,0,0,0.52)', padding: '5px 14px',
      border: '1px solid rgba(100,180,255,0.28)', borderRadius: '4px',
    }, 'TAB — SWITCH TO GUNNER SEAT');
  }

  _el(id, extraStyles, text) {
    const el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', fontFamily: "'Courier New', monospace",
      letterSpacing: '1px', display: 'none', zIndex: '1010',
      pointerEvents: 'none',
      ...extraStyles
    });
    el.textContent = text;
    document.body.appendChild(el);
    return el;
  }

  showEnterPrompt(text) {
    this.enterPrompt.textContent = text;
    this.enterPrompt.style.display = 'block';
  }
  hideEnterPrompt() { this.enterPrompt.style.display = 'none'; }

  showVehicleBar(seat, speedMps, isGunner) {
    this.vehicleBar.style.display = 'block';
    const kmh = Math.round(speedMps * 3.6);
    this.vehicleBar.innerHTML =
      `<span style="color:#ffe066;font-weight:bold">WARTHOG — ${seat}</span><br>` +
      `SPEED: ${kmh} km/h<br>` +
      (isGunner ? '<span style="color:#ff9944">LMB: FIRE CHAIN-GUN</span><br>' : '') +
      `<span style="color:#aaa">F: EXIT VEHICLE</span>`;
  }
  hideVehicleBar() { this.vehicleBar.style.display = 'none'; }

  showSwapHint(text) {
    this.swapHint.textContent = text;
    this.swapHint.style.display = 'block';
  }
  hideSwapHint() { this.swapHint.style.display = 'none'; }

  dispose() {
    [this.enterPrompt, this.vehicleBar, this.swapHint].forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }
}

// ============================================================================
// VehicleSystem — top-level manager wired into game.js
// ============================================================================
class VehicleSystem {
  /**
   * @param {BABYLON.Scene}  scene
   * @param {BABYLON.Camera} camera          — game's UniversalCamera
   * @param {Function}       getTerrainHeight — levelData.getTerrainHeight
   * @param {Object}         keys            — shared keys{} object from game.js
   */
  constructor(scene, camera, getTerrainHeight, keys) {
    this.scene            = scene;
    this.camera           = camera;
    this.getTerrainHeight = getTerrainHeight;
    this.keys             = keys;

    // getGroundY wrapper: use the game's scene raycast if available
    this._getGroundY = (pos) => {
      const ray = new BABYLON.Ray(
        new BABYLON.Vector3(pos.x, pos.y + 2, pos.z),
        v3(0, -1, 0), 80
      );
      const hit = scene.pickWithRay(ray, (m) =>
        m.checkCollisions &&
        !m.name.startsWith('warthog') && !m.name.startsWith('wCab') &&
        !m.name.startsWith('wTire') && !m.name.startsWith('wRim') &&
        !m.name.startsWith('wWheel') && !m.name.startsWith('wBump') &&
        !m.name.startsWith('wBed') && !m.name.startsWith('wbody') &&
        !m.name.startsWith('turret') && !m.name.startsWith('barrel') &&
        !m.name.startsWith('tracer')
      );
      if (hit && hit.hit && hit.pickedPoint) return hit.pickedPoint.y;
      return getTerrainHeight(pos.x, pos.z);
    };

    this.vehicles        = [];
    this.activeVehicle   = null;
    this.activeSeat      = -1;

    // Accumulated mouse for turret
    this._mdx = 0;
    this._mdy = 0;
    this._lmb = false;

    // Key edge detection
    this._fPrev   = false;
    this._tabPrev = false;

    this.hud = new VehicleHUD();

    // Spawn one Warthog near the central platform
    this._spawnWarthog(new BABYLON.Vector3(14, 7, -24));

    // Mouse listeners
    this._onMove = (e) => { this._mdx += e.movementX || 0; this._mdy += e.movementY || 0; };
    this._onDown = (e) => { if (e.button === 0) this._lmb = true;  };
    this._onUp   = (e) => { if (e.button === 0) this._lmb = false; };
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('mouseup',   this._onUp);
  }

  _spawnWarthog(pos) {
    // Place slightly above terrain so it settles
    const groundY = this._getGroundY(pos);
    pos.y = groundY + WARTHOG_CFG.chassisH / 2 + WARTHOG_CFG.suspRestLen + 0.4;
    const w = new Warthog(this.scene, pos, this._getGroundY);
    this.vehicles.push(w);
    return w;
  }

  // --------------------------------------------------------------------------
  // Main update — called once per frame from game.js render loop
  // --------------------------------------------------------------------------
  update(dt) {
    const keys = this.keys;

    // ---- Edge detect F / Tab ----
    const fNow   = keys['f']   === true;
    const tabNow = keys['tab'] === true;
    const fPress   = fNow   && !this._fPrev;
    const tabPress = tabNow && !this._tabPrev;
    this._fPrev   = fNow;
    this._tabPrev = tabNow;

    // ---- F key logic ----
    if (fPress) {
      if (this.activeVehicle === null) {
        this._tryEnter();
      } else {
        this._doExit();
      }
    }

    // ---- TAB: switch seats ----
    if (tabPress && this.activeVehicle) {
      this._switchSeat();
    }

    // ---- Nearby vehicle prompt ----
    if (!this.activeVehicle) {
      const near = this._nearestVehicle(WARTHOG_CFG.enterRadius);
      if (near) {
        if (near.isDriverFree()) {
          this.hud.showEnterPrompt('[ F ] ENTER WARTHOG — DRIVER SEAT');
        } else if (near.isPassengerFree()) {
          this.hud.showEnterPrompt('[ F ] ENTER WARTHOG — GUNNER SEAT');
        } else {
          this.hud.hideEnterPrompt();
        }
      } else {
        this.hud.hideEnterPrompt();
      }
      this.hud.hideVehicleBar();
      this.hud.hideSwapHint();
    } else {
      this.hud.hideEnterPrompt();

      const v          = this.activeVehicle;
      const isGunner   = this.activeSeat === 1;
      const isDriver   = this.activeSeat === 0;

      // ---- Driver input ----
      if (isDriver) {
        v.throttle  = keys['w'] ? 1 : (keys['s'] ? -1 : 0);
        v.steer     = keys['d'] ? 1 : (keys['a'] ? -1 : 0);
        v.handbrake = keys[' '] === true;
      } else {
        v.throttle  = 0;
        v.steer     = 0;
        v.handbrake = false;
      }

      // ---- Gunner input ----
      if (isGunner) {
        v.turretMouseDX = this._mdx;
        v.turretMouseDY = this._mdy;
        v.turretFiring  = this._lmb;
      }

      // ---- Snap camera to seat ----
      const seatPos = v.seatPosition(this.activeSeat);
      this.camera.position.copyFrom(seatPos);

      if (isDriver) {
        // Face same direction as vehicle
        this.camera.rotation.y = v.rotY + Math.PI;
        this.camera.rotation.x = 0;
      }
      // Gunner: let game.js pointer-lock mouse look continue normally for look-around

      // ---- HUD ----
      const spd  = Math.sqrt(v.vel.x * v.vel.x + v.vel.z * v.vel.z);
      const seat = isDriver ? 'DRIVER' : 'GUNNER';
      this.hud.showVehicleBar(seat, spd, isGunner);

      if (isDriver && v.isPassengerFree()) {
        this.hud.showSwapHint('[ TAB ] SWITCH TO GUNNER SEAT');
      } else if (isGunner && v.isDriverFree()) {
        this.hud.showSwapHint('[ TAB ] SWITCH TO DRIVER SEAT');
      } else {
        this.hud.hideSwapHint();
      }
    }

    // ---- Update all vehicles ----
    this.vehicles.forEach(v => v.update(dt));

    // Reset accumulated mouse
    this._mdx = 0;
    this._mdy = 0;
  }

  // --------------------------------------------------------------------------
  _nearestVehicle(maxDist) {
    let best = null, bestD = maxDist;
    this.vehicles.forEach(v => {
      const d = BABYLON.Vector3.Distance(this.camera.position, v.pos);
      if (d < bestD) { bestD = d; best = v; }
    });
    return best;
  }

  _tryEnter() {
    const v = this._nearestVehicle(WARTHOG_CFG.enterRadius);
    if (!v) return;

    const seat = v.isDriverFree() ? 0 : v.isPassengerFree() ? 1 : -1;
    if (seat === -1) return;

    v.enterSeat(seat);
    this.activeVehicle = v;
    this.activeSeat    = seat;

    // Suspend on-foot input
    this.camera.applyGravity = false;
    this.camera.keysUp    = [];
    this.camera.keysDown  = [];
    this.camera.keysLeft  = [];
    this.camera.keysRight = [];
  }

  _doExit() {
    const v = this.activeVehicle;
    if (!v) return;

    v.exitSeat(this.activeSeat);

    const exitPos = v.exitPosition(this.activeSeat);
    this.camera.position.copyFrom(exitPos);

    this.activeVehicle = null;
    this.activeSeat    = -1;

    // Resume on-foot physics
    this.camera.applyGravity = true;

    this.hud.hideVehicleBar();
    this.hud.hideSwapHint();
  }

  _switchSeat() {
    const v       = this.activeVehicle;
    const target  = this.activeSeat === 0 ? 1 : 0;
    if (v.seats[target] !== null) return; // occupied

    v.exitSeat(this.activeSeat);
    v.enterSeat(target);
    this.activeSeat = target;
  }

  dispose() {
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('mousedown', this._onDown);
    document.removeEventListener('mouseup',   this._onUp);
    this.vehicles.forEach(v => v.dispose());
    this.hud.dispose();
  }
}

// Expose globally for game.js
window.VehicleSystem = VehicleSystem;
