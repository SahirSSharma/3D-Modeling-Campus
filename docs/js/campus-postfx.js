/* Post-processing: the pass chain that turns the flat viewport into a lit one.
 *
 * One chain, both modes:  render -> GTAO -> bloom -> output.
 *
 *  - GTAO is ambient occlusion: contact shadow where walls meet ground and
 *    balconies overhang, which is most of what reads as "3D game" vs "CAD".
 *  - Bloom is kept far under music-video level (threshold close to white) so
 *    only the sky, the sun glint and emissive props ever glow.
 *  - OutputPass performs the renderer's own tone mapping + sRGB conversion at
 *    the END of the chain; without it the composer would resolve linear
 *    colours to screen and everything would look washed out.
 *
 * Look, not geometry. Nothing in this file moves, sizes or recolours an
 * entity; it changes how the measured scene is resolved to pixels — the same
 * art-direction licence the scooter run's sunset sky already has, now shared
 * by every mode (Sahir, 2026-08-16: "upgrade everything").
 *
 * The addons under vendor/three/addons shipped importing the bare specifier
 * `three`; those imports are rewritten in place to the relative module URL the
 * rest of docs/js uses, so there is exactly one THREE — and Node (which has no
 * import map) can resolve them too, which is what lets tests import any module
 * that pulls these in.
 */
import { EffectComposer } from "../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "../vendor/three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "../vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three/addons/postprocessing/OutputPass.js";
import * as THREE from "../vendor/three/three.module.min.js";

export function createPostfx({ renderer, scene, camera }) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  /* Modest sample counts: GTAO's cost is per-pixel and the campus fills every
     pixel; the Poisson denoise pass is what buys smoothness back.

     TUNED DOWN 2026-08-17, and the numbers are load-bearing: the first pass
     shipped radius 2.2 / scale 1.4 / blend 0.9, and at that strength GTAO
     manufactured occlusion on open flat ground — every court on campus went
     from its measured colour to near-black, worst at distance where depth
     precision is thinnest. Sahir reported it from the live site; the bisect
     (passes.gtao.enabled, below) pinned it to this pass alone. Contact
     shadows survive at these values; if AO ever needs to be stronger, check
     the courts first. */
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.6;
  gtao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 2, thickness: 0.6,
    scale: 1.0, samples: 12, distanceFallOff: 0.5 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2.5, normalPhi: 3.5, radius: 6, rings: 3, samples: 12 });
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(size.clone(), 0.18, 0.55, 0.88);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  /* GTAO's internal resolution, as a fraction of the frame. Its blend step
     samples its own targets and upsamples, so computing AO at 0.5x is nearly
     invisible and roughly halves the pass's cost — which measurement says is
     the single largest slice of the frame. 0 disables the pass outright.
     composer.setSize re-sizes every pass to full frame, so the scaled gtao
     size is re-applied AFTER it, both here and on resize. */
  let gtaoScale = 1;
  let cur = { w: size.x, h: size.y };
  const applyGtaoSize = () => {
    gtao.enabled = gtaoScale > 0;
    if (gtaoScale > 0) {
      gtao.setSize(Math.max(2, Math.round(cur.w * gtaoScale)), Math.max(2, Math.round(cur.h * gtaoScale)));
    }
  };

  return {
    render() { composer.render(); },
    setSize(w, h) {
      cur = { w, h };
      /* EffectComposer caches the renderer's pixel ratio at CONSTRUCTION and
         only re-reads it via setPixelRatio — without this line the adaptive
         controller's pixel-ratio rungs resize the canvas but every pass keeps
         rendering at the boot-time ratio (found in review: the rungs were
         inert). */
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      applyGtaoSize();
      bloom.setSize(w, h);
    },
    setGtaoScale(s) {
      if (s === gtaoScale) return;
      gtaoScale = s;
      applyGtaoSize();
    },
    /* The manipulation seam, campus-walk.js style: each pass reachable from
       the console so a rendering fault can be bisected live — turning passes
       off one at a time is how the double-tone-mapping regression was found. */
    passes: { gtao, bloom },
  };
}
