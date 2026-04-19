# Enemy Asset Setup Guide

Quick reference for getting 3D models for your Covenant enemies.

## Option 1: Free Assets from Sketchfab (EASIEST) ⭐

### Requirements
- Sketchfab account (free)
- ~5 minutes per model

### Step-by-Step

**For Elite Models:**

1. Go to: https://sketchfab.com/3d-models/enemieshalo-4covenantelites-3072f3df595349e29a98621182245231
   - By: jameslucino117
   - High quality Halo 4 style

2. Click "Download" button (bottom right)

3. Choose format: **GLB** (most compatible with Babylon.js)

4. Extract/save to: `fps-game/assets/enemies/elite_1.glb`

5. Download 2-3 more variants:
   - [Halo 5 Elites](https://sketchfab.com/3d-models/halo-5-elites-90146747d76f45a0b73c9f280a568600)
   - Save as: `elite_2.glb`, `elite_3.glb`

**For Grunt Models:**

1. Go to: https://sketchfab.com/3d-models/enemieshalo-4covenantgrunts-824b06222765476a8775675e22709289
   - By: jameslucino117
   - Halo 4 style Grunts

2. Download as GLB

3. Save to: `fps-game/assets/enemies/grunt_1.glb`

4. Get variants:
   - [Halo Reach Grunts](https://sketchfab.com/3d-models/grunts-halo-reach-a4e99f48107c42738714614e5a96f130)
   - Save as: `grunt_2.glb`, `grunt_3.glb`

### Result
```
fps-game/assets/enemies/
├── elite_1.glb     ✓
├── elite_2.glb     ✓
├── elite_3.glb     ✓
├── grunt_1.glb     ✓
├── grunt_2.glb     ✓
└── grunt_3.glb     ✓
```

Game will now load actual Halo-style models!

---

## Option 2: AI-Generated Models (BEST QUALITY)

### Tripo 3D (Recommended for games)

**Why Tripo?**
- ✅ Game-ready quad topology
- ✅ Fast generation (~30 seconds)
- ✅ Stylization options (LEGO, voxel, cartoon)
- ✅ Affordable ($0.10-0.30 per model)
- ✅ Free tier: 300 credits/month

**Setup:**

1. Go to https://www.tripo3d.ai/
2. Sign up (free account)
3. Get API key from dashboard
4. Set environment variable:
   ```bash
   export TRIPO3D_API_KEY="your-key-here"
   ```

**Generate via Web UI (Easiest):**

1. Dashboard → Text to 3D
2. Enter prompt:
   - **Grunt:** "Small alien soldier Covenant stocky compact frame mandible"
   - **Elite:** "Tall alien elite warrior armored plasma sword"
3. Click Generate
4. Wait 30 seconds
5. Download GLB
6. Save to `assets/enemies/`

**Generate via Python (Batch):**

```python
import json
import time
from urllib import request, parse

API_KEY = "your-tripo3d-api-key"

def generate_model(prompt, filename):
    """Generate a 3D model from text"""

    data = {
        "type": "text_to_model",
        "prompt": prompt,
        "model_version": "v3.0"
    }

    # Create task
    req = request.Request(
        'https://api.tripo3d.ai/v2/openapi/models',
        data=json.dumps(data).encode(),
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    try:
        with request.urlopen(req) as response:
            result = json.loads(response.read())
            task_id = result['data']['task_id']
            print(f"✓ Task created: {task_id}")
            print(f"  Filename: {filename}")
            print(f"  Prompt: {prompt}")
            return task_id
    except Exception as e:
        print(f"✗ Error: {e}")
        return None

# Generate enemies
generate_model(
    "Halo Covenant Grunt small alien soldier compact frame mandible jaw",
    "grunt_1.glb"
)
generate_model(
    "Halo Covenant Grunt variant sci-fi alien trooper short stature",
    "grunt_2.glb"
)
generate_model(
    "Halo Elite Sangheili tall warrior armored plasma sword elegant",
    "elite_1.glb"
)
generate_model(
    "Covenant Elite armored alien warrior sleek imposing stance",
    "elite_2.glb"
)

print("\n✓ Check Tripo 3D dashboard for generation status")
print("✓ Download GLB files when complete")
print("✓ Save to: fps-game/assets/enemies/")
```

Run:
```bash
python generate_enemies.py
```

**Good Prompts:**

```
Grunts (Short, stocky, energetic):
- "Sci-fi alien soldier compact frame blue suit"
- "Covenant grunt short alien protective suit mandible"
- "Halo-inspired alien trooper small stature"

Elites (Tall, elegant, armored):
- "Halo elite armored warrior tall elegant plasma rifle"
- "Covenant elite alien commander imposing stance"
- "Sci-fi elite soldier sleek futuristic armor"
```

---

### Meshy AI (Enterprise-grade, auto-rigging)

**Why Meshy?**
- ✅ Auto-rigging (characters already ready to animate)
- ✅ High security (ISO 27001, SOC2)
- ✅ PBR textures included
- ✅ Multiple export formats
- ❌ Slower (2-3 minutes)
- ❌ Higher cost

**Setup:**

1. Go to https://www.meshy.ai/
2. Create account (free tier: 200 credits/month)
3. Get API key

**Generate:**

```python
import json
from urllib import request

API_KEY = "your-meshy-api-key"

data = {
    "object_prompt": "Halo Elite warrior tall armored plasma sword",
    "model_type": "preview"  # or "refine" for detailed version
}

req = request.Request(
    'https://api.meshy.ai/v2/text-to-3d',
    data=json.dumps(data).encode(),
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    method='POST'
)

with request.urlopen(req) as response:
    result = json.loads(response.read())
    print(f"Task ID: {result['result']['task_id']}")
    # Check status later, download when complete
```

---

## Troubleshooting Assets

### Issue: "assets/enemies/ not found"

**Fix:**
```bash
mkdir -p fps-game/assets/enemies
cd fps-game/assets/enemies
# Download GLB files here
```

### Issue: Models too large (slow loading)

**Fix:**
1. Use Tripo 3D (auto-optimizes)
2. Or compress with [glTF-Transform](https://gltf-transform.dev/)

```bash
npm install -g @gltf-transform/cli

gltf-transform compress model.glb model-compressed.glb
```

### Issue: Models don't look right in-game

**Fix:**
1. Check scale in level.js if needed
2. Models auto-scale to fit enemy class
3. Try different model file if available

### Issue: Downloaded models have bad topology

**Fix:**
1. Use Tripo 3D (better quad topology for games)
2. Or request specific topology in prompt:
   - "Low-poly optimized game model"
   - "Quad-based topology suitable for animation"

---

## File Structure Checklist

```
fps-game/
├── index.html                ✓ Updated with script refs
├── game.js                  ✓ Updated with enemy integration
├── enemies.js               ✓ Enemy class definitions
├── ai-behaviors.js          ✓ AI logic and helpers
├── enemy-spawner.js         ✓ Wave management
├── level.js                 ✓ Existing
├── vehicle.js               ✓ Existing
├── ENEMY_SYSTEM.md          ✓ Documentation (you're reading this!)
├── ASSET_GUIDE.md           ✓ This file
├── style.css                ✓ Existing
└── assets/
    └── enemies/
        ├── grunt_1.glb      ← Download or generate
        ├── grunt_2.glb      ← Download or generate
        ├── grunt_3.glb      ← Download or generate
        ├── elite_1.glb      ← Download or generate
        ├── elite_2.glb      ← Download or generate
        └── elite_3.glb      ← Download or generate
```

---

## Quick Start (5 minutes)

1. **Create directory:**
   ```bash
   mkdir -p fps-game/assets/enemies
   ```

2. **Download from Sketchfab:**
   - [Elite Model](https://sketchfab.com/3d-models/enemieshalo-4covenantelites-3072f3df595349e29a98621182245231)
   - [Grunt Model](https://sketchfab.com/3d-models/enemieshalo-4covenantgrunts-824b06222765476a8775675e22709289)
   - Save as GLB to `assets/enemies/`

3. **Run game:**
   ```bash
   # Serve fps-game/ directory on localhost
   python -m http.server 8000
   # Open http://localhost:8000
   ```

4. **Play!**
   - Enemies spawn in waves
   - Use real 3D models automatically

---

## Advanced: Custom Models

Want to use your own 3D models?

**Requirements:**
- GLB format (compatible with Babylon.js)
- Roughly humanoid shape for behavior to work
- Scale: ~1-2 units tall (game scale)

**Steps:**
1. Export/save as GLB
2. Place in `assets/enemies/`
3. Rename to `grunt_X.glb` or `elite_X.glb`
4. Game auto-loads on next run!

**Tools:**
- [Blender](https://www.blender.org/) (free, export as GLB)
- [3D Coat](https://3dcoat.com/)
- [Nomad Sculpt](https://nomadsculpt.com/)

---

## Support

- **Sketchfab Issues?** Check download tutorial: https://help.sketchfab.com/hc/articles/203592686
- **Tripo 3D Issues?** API docs: https://docs.tripo3d.ai/
- **Meshy AI Issues?** API docs: https://docs.meshy.ai/
- **Babylon.js Loading?** Docs: https://doc.babylonjs.com/features/featuresDeepDive/Babylon.js_and_Blender

---

**Ready to battle?** Download your assets and play! 🎮
