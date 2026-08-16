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
     pixel; the Poisson denoise pass is what buys smoothness back. */
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.6, thickness: 1.2,
    scale: 1.4, samples: 12, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2.5, normalPhi: 3.5, radius: 6, rings: 3, samples: 12 });
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(size.clone(), 0.18, 0.55, 0.88);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  return {
    render() { composer.render(); },
    setSize(w, h) {
      composer.setSize(w, h);
      gtao.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
