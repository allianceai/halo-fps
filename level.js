// ============================================================================
// RING WORLD OUTDOOR LEVEL — Halo CE Inspired
// Assets: Procedural geometry (CC0, no external deps required)
// Geometry inspired by Kenney Nature Kit (kenney.nl/assets/nature-kit, CC0)
// and Quaternius Sci-Fi Megakit (sketchfab.com/quaternius, CC0)
// ============================================================================

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Terrain height formula — must match what CreateGround uses so raycasts
  // and manual placements all agree on Y values.
  // --------------------------------------------------------------------------
  function calcTerrainY(x, z) {
    let y = 0;
    y += Math.sin(x * 0.022) * 7;
    y += Math.cos(z * 0.025) * 5;
    y += Math.sin((x + z) * 0.016) * 9;
    y += Math.cos((x - z) * 0.031) * 3.5;
    y += Math.sin(x * 0.065) * 1.8;
    y += Math.cos(z * 0.078) * 1.2;

    // Flatten centre — Forerunner platform sits here
    const d = Math.sqrt(x * x + z * z);
    if (d < 45) y *= d / 45;

    // Flatten main vehicle paths
    const pathNS = Math.max(0, 1 - Math.abs(x) / 14);
    const pathEW = Math.max(0, 1 - Math.abs(z) / 14);
    y *= 1 - Math.max(pathNS, pathEW) * 0.72;

    return y;
  }

  // --------------------------------------------------------------------------
  // buildLevel(scene) — call once after scene is created.
  // Returns { getTerrainHeight, skyDome } so game.js can use them.
  // --------------------------------------------------------------------------
  window.buildLevel = function buildLevel(scene) {

    // ========================================================================
    // ATMOSPHERE
    // ========================================================================
    scene.clearColor = new BABYLON.Color4(0.44, 0.64, 0.94, 1);
    scene.fogMode   = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor  = new BABYLON.Color3(0.58, 0.72, 0.94);
    scene.fogDensity = 0.0038;

    // ========================================================================
    // LIGHTING  — Halo CE warm outdoor palette
    // ========================================================================

    // Clear any lights created by game.js before this call
    scene.lights.slice().forEach(l => l.dispose());

    // Primary sun
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.55, -1, 0.38), scene);
    sun.intensity = 1.25;
    sun.diffuse   = new BABYLON.Color3(1.0, 0.96, 0.84);
    sun.specular  = new BABYLON.Color3(0.6, 0.55, 0.4);

    // Sky/fill hemisphere
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.55;
    hemi.diffuse     = new BABYLON.Color3(0.75, 0.82, 1.0);
    hemi.groundColor = new BABYLON.Color3(0.38, 0.32, 0.22);

    // ========================================================================
    // MATERIALS
    // ========================================================================

    const matTerrain = new BABYLON.StandardMaterial('matTerrain', scene);
    matTerrain.diffuseColor  = new BABYLON.Color3(0.28, 0.48, 0.22);
    matTerrain.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);

    const matRock = new BABYLON.StandardMaterial('matRock', scene);
    matRock.diffuseColor  = new BABYLON.Color3(0.51, 0.48, 0.42);
    matRock.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);

    const matForerunner = new BABYLON.StandardMaterial('matForerunner', scene);
    matForerunner.diffuseColor  = new BABYLON.Color3(0.58, 0.61, 0.70);
    matForerunner.specularColor = new BABYLON.Color3(0.28, 0.30, 0.40);
    matForerunner.specularPower = 48;

    const matAccent = new BABYLON.StandardMaterial('matAccent', scene);
    matAccent.diffuseColor   = new BABYLON.Color3(0.38, 0.44, 0.56);
    matAccent.emissiveColor  = new BABYLON.Color3(0.04, 0.09, 0.14);
    matAccent.specularColor  = new BABYLON.Color3(0.5, 0.5, 0.6);
    matAccent.specularPower  = 64;

    const matRamp = new BABYLON.StandardMaterial('matRamp', scene);
    matRamp.diffuseColor  = new BABYLON.Color3(0.52, 0.55, 0.64);
    matRamp.specularColor = new BABYLON.Color3(0.15, 0.15, 0.2);

    const matPath = new BABYLON.StandardMaterial('matPath', scene);
    matPath.diffuseColor  = new BABYLON.Color3(0.56, 0.52, 0.44);
    matPath.specularColor = new BABYLON.Color3(0.05, 0.05, 0.04);

    const matTrunk = new BABYLON.StandardMaterial('matTrunk', scene);
    matTrunk.diffuseColor = new BABYLON.Color3(0.40, 0.26, 0.10);

    const matFoliage = new BABYLON.StandardMaterial('matFoliage', scene);
    matFoliage.diffuseColor = new BABYLON.Color3(0.18, 0.50, 0.14);

    const matGlowBlue = new BABYLON.StandardMaterial('matGlowBlue', scene);
    matGlowBlue.emissiveColor = new BABYLON.Color3(0.0, 0.55, 1.0);
    matGlowBlue.disableLighting = true;

    // ========================================================================
    // TERRAIN — 400 × 400 with hand-authored sine heightmap
    // Inspired by Kenney Nature Kit modular terrain tiles
    // ========================================================================
    const TERRAIN_SIZE = 400;
    const TERRAIN_SUBDIV = 64;

    const terrain = BABYLON.MeshBuilder.CreateGround('terrain', {
      width: TERRAIN_SIZE, height: TERRAIN_SIZE,
      subdivisions: TERRAIN_SUBDIV,
      updatable: true
    }, scene);

    const positions = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const normals   = new Float32Array(positions.length);

    for (let i = 0, n = positions.length / 3; i < n; i++) {
      positions[i * 3 + 1] = calcTerrainY(positions[i * 3], positions[i * 3 + 2]);
    }
    terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    BABYLON.VertexData.ComputeNormals(positions, terrain.getIndices(), normals);
    terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    terrain.material = matTerrain;
    terrain.checkCollisions = true;
    terrain.receiveShadows  = true;
    terrain.isPickable = true;

    // ========================================================================
    // VEHICLE PATHS — thin overlay slabs just above terrain surface
    // ========================================================================
    const pathDefs = [
      // [cx, cz, w, d]
      [0,    0,   14, 90],   // N-S centre
      [0,   90,   14, 90],   // N extension
      [0,  -90,   14, 90],   // S extension
      [0,    0,   90, 14],   // E-W centre
      [90,   0,   90, 14],   // E extension
      [-90,  0,   90, 14],   // W extension
    ];
    pathDefs.forEach(([cx, cz, w, d], i) => {
      const p = BABYLON.MeshBuilder.CreateGround(`path_${i}`, {
        width: w, height: d, subdivisions: 1
      }, scene);
      p.position.set(cx, calcTerrainY(cx, cz) + 0.18, cz);
      p.material = matPath;
    });

    // ========================================================================
    // ROCKS — cover scatter (Kenney Nature Kit "rock" shapes approximated
    //         with low-segment spheroids)
    // ========================================================================
    const rockDefs = [
      // [x, z, sx, sy, sz, ry]
      [16,   6, 3.2, 2.2, 2.8, 0.4],
      [-19,  9, 4.0, 2.6, 3.2, 1.2],
      [26, -16, 2.8, 1.9, 2.3, 0.9],
      [-21,-21, 5.0, 3.2, 4.2, 0.2],
      [36,  11, 3.1, 2.1, 2.6, 1.6],
      [-31, 16, 4.2, 2.2, 3.1, 0.8],
      [13, -31, 2.2, 1.6, 2.1, 0.5],
      [-13, 31, 3.6, 2.1, 3.0, 1.9],
      [52,   1, 5.2, 3.1, 4.2, 0.7],
      [-51,-11, 4.1, 2.6, 3.6, 1.3],
      [41, -36, 3.1, 2.1, 2.6, 0.8],
      [-41, 36, 4.6, 2.6, 4.1, 1.5],
      [62,  21, 3.6, 2.1, 3.1, 0.4],
      [-61,-26, 3.1, 1.9, 2.6, 1.8],
      [21,  51, 4.1, 2.6, 3.1, 0.6],
      [-26,-51, 5.1, 3.1, 4.1, 1.1],
      [71, -11, 3.1, 2.1, 2.6, 0.3],
      [-71,  6, 4.1, 2.1, 3.1, 1.4],
      [31, -61, 2.6, 1.6, 2.1, 0.9],
      [-36, 61, 3.6, 2.1, 3.1, 1.7],
      [6,   36, 2.1, 1.6, 1.9, 0.5],
      [-6, -36, 3.1, 2.1, 2.6, 1.2],
      [46,  51, 4.1, 2.6, 3.6, 1.0],
      [-46,-56, 3.6, 2.1, 3.1, 0.7],
      [81,  31, 5.1, 3.1, 4.6, 1.5],
      [-81,-31, 4.1, 2.6, 3.6, 0.4],
      [55,  75, 3.2, 2.2, 2.8, 1.1],
      [-55, 75, 3.8, 2.4, 3.2, 0.6],
      [55, -75, 3.0, 2.0, 2.6, 0.9],
      [-55,-75, 4.2, 2.8, 3.6, 1.3],
    ];

    rockDefs.forEach(([x, z, sx, sy, sz, ry], i) => {
      const r = BABYLON.MeshBuilder.CreateSphere(`rock_${i}`, {
        diameterX: sx * 2, diameterY: sy * 2, diameterZ: sz * 2,
        segments: 4
      }, scene);
      r.rotation.set(Math.random() * 0.25, ry, Math.random() * 0.15);
      r.position.set(x, calcTerrainY(x, z) + sy * 0.55, z);
      r.material = matRock;
      r.checkCollisions = true;
      r.isPickable = true;
    });

    // ========================================================================
    // FORERUNNER CENTRAL PLATFORM
    // Width/depth 44 × 44, height 4.5 — sitting at y=0 so top is y=4.5
    // Forerunner architecture: modular rectangular blocks with accent strips
    // ========================================================================
    const PLAT_TOP = 4.5;

    const mainPlat = BABYLON.MeshBuilder.CreateBox('mainPlat', {
      width: 44, height: PLAT_TOP, depth: 44
    }, scene);
    mainPlat.position.set(0, PLAT_TOP / 2, 0);
    mainPlat.material = matForerunner;
    mainPlat.checkCollisions = true;
    mainPlat.isPickable = true;

    // Accent rim strips on top edge
    [
      [0, 22.5, 46, 2],   // N
      [0, -22.5, 46, 2],  // S
      [22.5, 0, 2, 46],   // E
      [-22.5, 0, 2, 46],  // W
    ].forEach(([rx, rz, rw, rd], i) => {
      const strip = BABYLON.MeshBuilder.CreateBox(`rim_${i}`, {
        width: rw, height: 0.5, depth: rd
      }, scene);
      strip.position.set(rx, PLAT_TOP + 0.25, rz);
      strip.material = matAccent;
    });

    // Glow panel inserts on sides (Forerunner light strips)
    [
      [0, 22, 0],          // N face
      [0, -22, Math.PI],   // S face
      [22, 0, -Math.PI/2], // E face
      [-22, 0, Math.PI/2], // W face
    ].forEach(([px, pz, ry], i) => {
      const panel = BABYLON.MeshBuilder.CreateBox(`glowPanel_${i}`, {
        width: 12, height: 1.2, depth: 0.2
      }, scene);
      panel.position.set(px, PLAT_TOP * 0.6, pz);
      panel.rotation.y = ry;
      panel.material = matGlowBlue;
    });

    // ---- Ramps (4 cardinal directions, vehicle-navigable slope) ----
    const RAMP_W = 10, RAMP_D = 16;
    const rampAngle = Math.atan2(PLAT_TOP, RAMP_D);
    [
      [0,  22 + RAMP_D / 2 * Math.cos(rampAngle), 0        ],
      [0, -22 - RAMP_D / 2 * Math.cos(rampAngle), Math.PI  ],
      [ 22 + RAMP_D / 2 * Math.cos(rampAngle), 0, -Math.PI/2],
      [-22 - RAMP_D / 2 * Math.cos(rampAngle), 0,  Math.PI/2],
    ].forEach(([rx, rz, ry], i) => {
      const ramp = BABYLON.MeshBuilder.CreateBox(`ramp_${i}`, {
        width: RAMP_W, height: 0.45, depth: RAMP_D
      }, scene);
      ramp.rotation.set(rampAngle, ry, 0);
      ramp.position.set(rx, PLAT_TOP / 2, rz);
      ramp.material = matRamp;
      ramp.checkCollisions = true;
      ramp.isPickable = true;
    });

    // ---- Central Forerunner Monolith / Cartographer Tower ----
    const MONO_H = 22;
    const mono = BABYLON.MeshBuilder.CreateBox('monolith', {
      width: 4.5, height: MONO_H, depth: 4.5
    }, scene);
    mono.position.set(0, PLAT_TOP + MONO_H / 2, 0);
    mono.material = matForerunner;
    mono.checkCollisions = true;
    mono.isPickable = true;

    const monoCap = BABYLON.MeshBuilder.CreateBox('monolithCap', {
      width: 7, height: 2, depth: 7
    }, scene);
    monoCap.position.set(0, PLAT_TOP + MONO_H + 1, 0);
    monoCap.material = matAccent;
    monoCap.checkCollisions = true;

    // Glow strips on monolith corners
    for (let c = 0; c < 4; c++) {
      const ang = (c / 4) * Math.PI * 2 + Math.PI / 4;
      const glow = BABYLON.MeshBuilder.CreateBox(`monoGlow_${c}`, {
        width: 0.2, height: MONO_H * 0.7, depth: 0.2
      }, scene);
      glow.position.set(
        Math.cos(ang) * 2.3,
        PLAT_TOP + MONO_H * 0.5,
        Math.sin(ang) * 2.3
      );
      glow.material = matGlowBlue;
    }

    // ========================================================================
    // FORERUNNER SIDE PLATFORMS — four quadrant outposts
    // ========================================================================
    const outpostDefs = [
      ['ne',  75,  75],
      ['nw', -75,  75],
      ['se',  75, -75],
      ['sw', -75, -75],
    ];

    outpostDefs.forEach(([id, ox, oz]) => {
      const ty  = calcTerrainY(ox, oz);
      const ph  = 3.5;
      const ptop = ty + ph;

      // Platform slab
      const plat = BABYLON.MeshBuilder.CreateBox(`outpost_${id}`, {
        width: 22, height: ph, depth: 22
      }, scene);
      plat.position.set(ox, ty + ph / 2, oz);
      plat.material = matForerunner;
      plat.checkCollisions = true;
      plat.isPickable = true;

      // Rim accent
      const rim = BABYLON.MeshBuilder.CreateBox(`outpost_rim_${id}`, {
        width: 24, height: 0.4, depth: 24
      }, scene);
      rim.position.set(ox, ptop + 0.2, oz);
      rim.material = matAccent;

      // Sniper tower
      const tH = 14;
      const tx = ox + (id.endsWith('e') ? -6 : 6);
      const tz = oz + (id.startsWith('n') ? -6 : 6);
      const tty = calcTerrainY(tx, tz);

      const tower = BABYLON.MeshBuilder.CreateBox(`tower_${id}`, {
        width: 3.5, height: tH, depth: 3.5
      }, scene);
      tower.position.set(tx, tty + tH / 2, tz);
      tower.material = matForerunner;
      tower.checkCollisions = true;
      tower.isPickable = true;

      const towerTop = BABYLON.MeshBuilder.CreateBox(`towerTop_${id}`, {
        width: 7, height: 1.8, depth: 7
      }, scene);
      towerTop.position.set(tx, tty + tH + 0.9, tz);
      towerTop.material = matAccent;
      towerTop.checkCollisions = true;
      towerTop.isPickable = true;

      // Ramp up to outpost
      const outRampAngle = Math.atan2(ph, 10);
      const rampOff = 11 + 5 * Math.cos(outRampAngle);
      const rampDir = id.startsWith('n') ? 1 : -1;
      const outRamp = BABYLON.MeshBuilder.CreateBox(`outRamp_${id}`, {
        width: 7, height: 0.4, depth: 10
      }, scene);
      outRamp.rotation.x = outRampAngle * rampDir;
      outRamp.position.set(ox, ty + ph / 2, oz + rampOff * rampDir);
      outRamp.material = matRamp;
      outRamp.checkCollisions = true;
      outRamp.isPickable = true;
    });

    // ========================================================================
    // FORERUNNER PILLAR CLUSTERS — 8 clusters of 3
    // ========================================================================
    const pillarClusterDefs = [
      [ 34,  42], [-34,  42],
      [ 34, -42], [-34, -42],
      [ 52,  22], [-52,  22],
      [ 52, -22], [-52, -22],
    ];

    pillarClusterDefs.forEach(([cx, cz], ci) => {
      for (let j = 0; j < 3; j++) {
        const px   = cx + (j - 1) * 4.5;
        const pz   = cz + (j % 2 === 0 ? 3 : 0);
        const pY   = calcTerrainY(px, pz);
        const pH   = 7 + (j * 3);
        const pillar = BABYLON.MeshBuilder.CreateBox(`pillar_${ci}_${j}`, {
          width: 1.6, height: pH, depth: 1.6
        }, scene);
        pillar.position.set(px, pY + pH / 2, pz);
        pillar.material = matForerunner;
        pillar.checkCollisions = true;
        pillar.isPickable = true;

        // Base block
        const base = BABYLON.MeshBuilder.CreateBox(`pillarBase_${ci}_${j}`, {
          width: 3, height: 0.8, depth: 3
        }, scene);
        base.position.set(px, pY + 0.4, pz);
        base.material = matAccent;
      }
    });

    // ========================================================================
    // ELEVATED WALKWAY — N–S spine bridge at y=9 connecting outposts
    // ========================================================================
    const BRIDGE_Y = 9.0;
    const bridgeSegments = [
      [0,  -100, 50], [0,  -55, 50], [0,  -10, 50],
      [0,   35, 50], [0,   80, 50],
    ];
    bridgeSegments.forEach(([bx, bz, bd], bi) => {
      const seg = BABYLON.MeshBuilder.CreateBox(`bridge_${bi}`, {
        width: 8, height: 0.55, depth: bd
      }, scene);
      seg.position.set(bx, BRIDGE_Y, bz);
      seg.material = matRamp;
      seg.checkCollisions = true;
      seg.isPickable = true;

      // Railings
      [-3.8, 3.8].forEach((rx, ri) => {
        const rail = BABYLON.MeshBuilder.CreateBox(`rail_${bi}_${ri}`, {
          width: 0.3, height: 1.2, depth: bd
        }, scene);
        rail.position.set(bx + rx, BRIDGE_Y + 0.85, bz);
        rail.material = matAccent;
        rail.checkCollisions = true;
      });
    });

    // Bridge support pillars
    bridgeSegments.forEach(([bx, bz], bi) => {
      [-15, 15].forEach((so, si) => {
        const spH  = BRIDGE_Y - calcTerrainY(bx, bz + so);
        const sp   = BABYLON.MeshBuilder.CreateBox(`bridgePillar_${bi}_${si}`, {
          width: 1.2, height: Math.max(spH, 1), depth: 1.2
        }, scene);
        sp.position.set(bx, calcTerrainY(bx, bz + so) + Math.max(spH, 1) / 2, bz + so);
        sp.material = matForerunner;
        sp.checkCollisions = true;
      });
    });

    // ========================================================================
    // LOW-POLY TREES — Kenney Nature Kit cone-style (trunk + foliage cone)
    // ========================================================================
    const treeDefs = [
      [90,  42], [-90,  42], [90, -42], [-90, -42],
      [82,  82], [-82,  82], [82, -82], [-82, -82],
      [105,  0], [-105,  0], [0,  105], [0, -105],
      [112, 62], [-112, 62], [112,-62], [-112,-62],
      [122, 30], [-122, 30], [122,-30], [-122,-30],
      [95, 110], [-95, 110], [95,-110], [-95,-110],
      [140, 50], [-140, 50], [140,-50], [-140,-50],
      [48,  98], [-48,  98], [48, -98], [-48, -98],
    ];

    treeDefs.forEach(([tx, tz], ti) => {
      const ty      = calcTerrainY(tx, tz);
      const trunkH  = 3.2 + (ti % 4) * 0.6;
      const canopyH = 5.5 + (ti % 3) * 1.8;
      const canopyR = 4.0 + (ti % 5) * 0.7;

      const trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk_${ti}`, {
        height: trunkH, diameterTop: 0.35, diameterBottom: 0.65, tessellation: 5
      }, scene);
      trunk.position.set(tx, ty + trunkH / 2, tz);
      trunk.material = matTrunk;

      const foliage = BABYLON.MeshBuilder.CreateCylinder(`foliage_${ti}`, {
        height: canopyH, diameterTop: 0, diameterBottom: canopyR * 2, tessellation: 5
      }, scene);
      foliage.position.set(tx, ty + trunkH + canopyH / 2 - 0.5, tz);
      foliage.material = matFoliage;
    });

    // ========================================================================
    // SCATTER CRATES — gameplay cover props (Forerunner supply crates)
    // ========================================================================
    const crateDefs = [
      [12,  -14], [-12,  14], [18, 8], [-18, -8],
      [8,   18],  [-8,  -18],
    ];
    const matCrate = new BABYLON.StandardMaterial('matCrate', scene);
    matCrate.diffuseColor  = new BABYLON.Color3(0.45, 0.48, 0.55);
    matCrate.specularColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    crateDefs.forEach(([cx, cz], ci) => {
      // On the main platform
      const crate = BABYLON.MeshBuilder.CreateBox(`crate_${ci}`, {
        width: 2.2, height: 1.6, depth: 2.2
      }, scene);
      crate.position.set(cx, PLAT_TOP + 0.8, cz);
      crate.material = matCrate;
      crate.checkCollisions = true;
      crate.isPickable = true;
    });

    // ========================================================================
    // RING-WORLD SKY DOME — large inverted sphere giving the horizon effect
    // ========================================================================
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', {
      diameter: 900, segments: 10
    }, scene);
    const matSky = new BABYLON.StandardMaterial('matSky', scene);
    matSky.emissiveColor    = new BABYLON.Color3(0.42, 0.60, 0.92);
    matSky.backFaceCulling  = false;
    matSky.disableLighting  = true;
    skyDome.material = matSky;
    skyDome.isPickable = false;

    // Subtle ring arc across the sky — the distant surface curving overhead
    const ringArc = BABYLON.MeshBuilder.CreateTorus('ringArc', {
      diameter: 820, thickness: 22, tessellation: 64
    }, scene);
    ringArc.rotation.x = Math.PI / 2;
    const matArc = new BABYLON.StandardMaterial('matArc', scene);
    matArc.diffuseColor   = new BABYLON.Color3(0.30, 0.52, 0.28);
    matArc.emissiveColor  = new BABYLON.Color3(0.06, 0.12, 0.06);
    matArc.disableLighting = true;
    matArc.backFaceCulling = false;
    ringArc.material = matArc;
    ringArc.isPickable = false;

    // ========================================================================
    // RETURN public API
    // ========================================================================
    return {
      getTerrainHeight: calcTerrainY,
      skyDome,
      playerStart: new BABYLON.Vector3(0, PLAT_TOP + 1.85, -12)
    };
  };

}());
