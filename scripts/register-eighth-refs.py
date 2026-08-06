#!/usr/bin/env python3
"""Register the nine Apple Maps 3D references of Eighth College into the local
world frame, and read the measurements out of them.

This is the pass .cache/eighth-ground/BUILD-SPEC.md §7 called "the one thing
that unlocks most of the OMIT list": nearly every deferred prop was measured in
PIXELS and never registered in world coordinates. It is kept as a script rather
than as prose so every number baked into docs/js/campus-eighth-furniture.js and
campus-eighth.js's MEASURED_COBBLE can be re-derived and FALSIFIED. A pass that
only registered the frames and left the detectors on someone's disk would be a
dossier again — the failure this repo has already been burned by — so the four
measurement passes below (--furniture, --turf, --colours, --cobble) are the
ones that produced the shipped tables, and they write their output to
scripts/reports/eighth/, which the JS modules copy verbatim and a unit test
compares against.

ANCHOR. ref2 is orthographic (its four painted court corners form a
parallelogram: opposite edges 168.0/166.1 px and 249.0/246.8 px, 0.9 %). Those
corners are SURVEYED — docs/data/campus-eighth.json ground.basketball-court —
so a plain affine ties ref2 to metres. Max residual 0.5 px = 4.6 cm at a scale
of 10.92 / 10.85 px per metre.

CHAIN. Every other frame is tied to ref2 by a ground-plane homography from
SIFT + RANSAC. A homography is exact for a plane; roof and facade features
carry parallax and fall out as outliers.

DETERMINISM. RANSAC is a randomised algorithm and this script used to run it
unseeded, so a frame sitting near the acceptance floor was accepted or rejected
depending on the draw — ref6 flipped run to run and the number quoted in the
build report was the best of six. Every pair is now run at SEEDS fixed seeds
and scored on the MEDIAN inlier count, and only the median is compared with the
floor, so acceptance is a property of the imagery rather than of the draw. The
homography kept is seed 0's, so the output is byte-stable.

Measured medians over 5 seeds, at the 25-inlier floor:
    ref3 1921  ref9 236  ref8 220  ref1 63  ref5 31   ACCEPTED
    ref6   11  ref4  18  ref7   8                     REJECTED
ref6 is REJECTED: its consensus is 11, not the 29 a lucky draw once reported.

FALSIFICATION, which is the part that matters: --overlay projects every ArcGIS
ground ring and massing footprint back onto each frame. The survey has to land
on the photographed beds, walkways, court paint and building BASES. A wrong
transform cannot do that.

Requires numpy, opencv-python-headless. Run from the repo root:
    python3 scripts/register-eighth-refs.py --overlay --ortho
    python3 scripts/register-eighth-refs.py --ortho --furniture --turf --colours --cobble
"""
import argparse, json, os, sys
import numpy as np

REFS = os.path.expanduser("~/.claude/jobs/e602f4bb/tmp/eighth-refs/")
NAMES = {
    "ref1": "ref1-oblique-court-lawn.png", "ref2": "ref2-plan-atlantis-keeling-court.png",
    "ref3": "ref3-plan-eighth-pulse-dora.png", "ref4": "ref4-plan-survivance-azad.png",
    "ref5": "ref5-oblique-theatre-district-dr.png", "ref6": "ref6-oblique-plaza-stairs-boulders.png",
    "ref7": "ref7-oblique-turf-patches-seating.png", "ref8": "ref8-steep-courtyard-paving-pattern.png",
    "ref9": "ref9-court-closeup.png",
}
OUT = ".cache/eighth-furniture"
REPORT = "scripts/reports/eighth"

# The four court corners, read off ref2 at 10x zoom on the white boundary
# stroke centres, against the four surveyed corners of the same rectangle.
PIX = np.array([[906.5, 813.5], [1074.0, 801.0], [1094.0, 1047.0], [928.5, 1061.5]])
WLD = np.array([[-163.2, 517.5], [-163.2, 532.9], [-185.9, 532.9], [-185.9, 517.5]])

# Ortho window and scale used for every measurement in the JS modules.
X0, Z0, S = -215, 495, 12
# 25 inliers is the floor: below it the RANSAC consensus is not a plane.
FLOOR = 25
# How many fixed seeds each pair is scored over. The median is what counts.
SEEDS = 5

# --- the plaza-object detector, stated once and used once -------------------
# A local-contrast blob: luminance above a 4 m Gaussian background by this much.
BLOB_CONTRAST = 14
# Plan-size window. Below it is paving speckle, above it is a structure.
BLOB_AREA_M2 = (0.5, 6.0)
BLOB_MAX_DIM = 3.5
# Only on SURVEYED paving, and never within this of a massing ring: beside a
# podium the ground-plane homography is exactly where facade parallax lands.
MASSING_CLEAR_M = 5.0
# Two frames must agree within this for the object to exist at all.
CONFIRM_M = 1.5
# Vegetation rule for the turf sweep: green over blue by this much.
GREEN_OVER_BLUE = 8


def world_to_ref2():
    aug = np.hstack([WLD, np.ones((4, 1))])
    M, *_ = np.linalg.lstsq(aug, PIX, rcond=None)
    H = np.eye(3)
    H[:2, :2] = M[:2].T
    H[:2, 2] = M[2]
    resid = np.abs((aug @ M) - PIX).max()
    return H, resid


def arcgis():
    return json.load(open("docs/data/campus-arcgis.json"))


def ortho_px(pts_m):
    """World metres -> ortho pixels, as an int32 ring for cv2.fillPoly."""
    return np.array([[(x - X0) * S, (z - Z0) * S] for x, z in pts_m], np.int32)


def layer_mask(arc, layer, kinds, shape):
    m = np.zeros(shape, np.uint8)
    rings = []
    for g in arc.get(layer, []):
        r = (g.get("r") or [None])[0]
        if not r or len(r) < 3:
            continue
        if kinds and g.get("k") not in kinds:
            continue
        rings.append(ortho_px([(x / 10.0, z / 10.0) for x, z in r]))
    if rings:
        import cv2
        cv2.fillPoly(m, rings, 255)
    return m


def read_ortho(cv2, name):
    p = f"{OUT}/ortho-{name}.png"
    if not os.path.exists(p):
        sys.exit(f"{p} is missing — run with --ortho first")
    return cv2.imread(p)


def blobs(cv2, im, ok):
    """Every local-contrast blob in the size window, on allowed ground.

    Returns [x, z, w, d] in metres. Deterministic: no sampling anywhere.
    """
    lum = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    m = ((lum - cv2.GaussianBlur(lum, (0, 0), 4 * S)) > BLOB_CONTRAST).astype(np.uint8)
    m[ok == 0] = 0
    n, _, st, ce = cv2.connectedComponentsWithStats(m, 8)
    out = []
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA] / S / S
        w = st[i, cv2.CC_STAT_WIDTH] / S
        d = st[i, cv2.CC_STAT_HEIGHT] / S
        if not (BLOB_AREA_M2[0] <= a <= BLOB_AREA_M2[1]):
            continue
        if w > BLOB_MAX_DIM or d > BLOB_MAX_DIM:
            continue
        out.append([X0 + ce[i][0] / S, Z0 + ce[i][1] / S, w, d])
    out.sort(key=lambda q: (round(q[1], 3), round(q[0], 3)))
    return out


def merge_overlapping(objs):
    """Fold together any two objects whose PLAN RECTANGLES intersect.

    A fixed-radius dedup cannot do this job: the confirmation tolerance is
    1.5 m and the objects themselves are 0.7-3.3 m, so one bench matching two
    blobs comes back as two boxes 0.4 m apart, which renders as one fused
    L-shaped solid with a z-fighting seam. Overlap is the only test that scales
    with the object. Iterated to a fixed point so a chain of three merges once.
    """
    cur = [list(o) for o in objs]
    while True:
        out = []
        merged = False
        for o in cur:
            hit = None
            for q in out:
                if abs(q[0] - o[0]) < (q[2] + o[2]) / 2 and abs(q[1] - o[1]) < (q[3] + o[3]) / 2:
                    hit = q
                    break
            if hit is None:
                out.append(list(o))
            else:
                for k in range(4):
                    hit[k] = (hit[k] + o[k]) / 2
                merged = True
        cur = out
        if not merged:
            return sorted(cur, key=lambda q: (round(q[1], 3), round(q[0], 3)))


def pass_furniture(cv2, W):
    """The plaza objects, from the detector rule stated at the top of the file."""
    if not {"ref3", "ref8"} <= set(W):
        sys.exit("--furniture needs ref3 and ref8 registered")
    im3, im8 = read_ortho(cv2, "ref3"), read_ortho(cv2, "ref8")
    shape = im3.shape[:2]
    arc = arcgis()
    ok = layer_mask(arc, "ground", {"walk"}, shape)

    # The massing clearance is tested RING BY RING, not against a rasterised
    # union. Some ArcGIS massing rings are self-intersecting, and a raster fill
    # leaves those with holes: two objects passed a rasterised gate here and
    # were then rejected by campus-eighth.js's hitsBuilding(), which is a ring
    # test. The gate has to be the same shape as the gate downstream or the
    # detector emits rows the renderer silently drops.
    mrings = []
    for g in arc.get("massing", []):
        r = (g.get("r") or [None])[0]
        if r and len(r) >= 3:
            mrings.append(np.array([[(x / 10.0 - X0) * S, (z / 10.0 - Z0) * S] for x, z in r], np.float32))

    def clear_of_massing(x, z):
        px, py = (x - X0) * S, (z - Z0) * S
        for r in mrings:
            if -cv2.pointPolygonTest(r, (float(px), float(py)), True) < MASSING_CLEAR_M * S:
                return False
        return True

    b3 = [b for b in blobs(cv2, im3, ok) if clear_of_massing(b[0], b[1])]
    b8 = [b for b in blobs(cv2, im8, ok) if clear_of_massing(b[0], b[1])]
    conf = []
    for a in b3:
        best = None
        for b in b8:
            dd = float(np.hypot(a[0] - b[0], a[1] - b[1]))
            if dd <= CONFIRM_M and (best is None or dd < best[0]):
                best = (dd, b)
        if best:
            b = best[1]
            conf.append([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2])
    objs = merge_overlapping(conf)
    print(f"  plaza: ref3 {len(b3)} blobs, ref8 {len(b8)}, "
          f"confirmed in both {len(conf)}, after overlap merge {len(objs)}")
    rows = [[round(v, 2) for v in o] for o in objs]
    write_report("plaza-objects.json", {
        "rule": {"contrast": BLOB_CONTRAST, "area_m2": list(BLOB_AREA_M2),
                 "max_dim_m": BLOB_MAX_DIM, "massing_clear_m": MASSING_CLEAR_M,
                 "confirm_m": CONFIRM_M, "frames": ["ref3", "ref8"]},
        "candidates": {"ref3": len(b3), "ref8": len(b8), "confirmed": len(conf)},
        "objects": rows,
    })
    for r in rows:
        print(f"    [{r[0]:8.2f}, {r[1]:7.2f}, {r[2]:.2f}, {r[3]:.2f}],")

    # The service enclosure: a min-area rectangle on its bright coping, ref2.
    if "ref2" in W:
        im2 = read_ortho(cv2, "ref2")
        sub = np.zeros(shape, np.uint8)
        cv2.rectangle(sub, ((-166 - X0) * S, (530 - Z0) * S), ((-153 - X0) * S, (543 - Z0) * S), 255, -1)
        lum = cv2.cvtColor(im2, cv2.COLOR_BGR2GRAY).astype(np.float32)
        m = ((lum - cv2.GaussianBlur(lum, (0, 0), 4 * S)) > BLOB_CONTRAST).astype(np.uint8)
        m[sub == 0] = 0
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
        if n > 1:
            i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            blob = (lab == i).astype(np.uint8)
            (cx, cy), (w, h), ang = cv2.minAreaRect(cv2.findNonZero(blob))
            med = np.median(im2[blob > 0], axis=0)
            print(f"  enclosure: centre ({X0 + cx / S:.2f}, {Z0 + cy / S:.2f}) "
                  f"{w / S:.2f} x {h / S:.2f} m at {ang:.1f} deg, coping median "
                  f"#{int(med[2]):02x}{int(med[1]):02x}{int(med[0]):02x}")
            write_report("enclosure.json", {
                "frames": ["ref2"], "cx": round(X0 + cx / S, 2), "cz": round(Z0 + cy / S, 2),
                "w": round(w / S, 2), "d": round(h / S, 2), "deg": round(float(ang), 1),
                "coping_median": "#%02x%02x%02x" % (int(med[2]), int(med[1]), int(med[0])),
            })


def pass_turf(cv2, W):
    """The turf panel: the whole vegetation component, not its sunlit half.

    A sunlit-only trace stops at the shadow line, which is not a ground edge —
    shadowed lawn is still lawn, and the difference here was 61 m² of real
    campus rendering as paving.
    """
    im3 = read_ortho(cv2, "ref3")
    shape = im3.shape[:2]
    eighth = json.load(open("docs/data/campus-eighth.json"))
    host = eighth["ground"]["courtyard-2369"]["points"]
    ring = np.zeros(shape, np.uint8)
    cv2.fillPoly(ring, [ortho_px(host)], 255)
    b, g, r = (im3[:, :, i].astype(np.int16) for i in range(3))
    veg = (((g - b) > GREEN_OVER_BLUE) & (ring > 0)).astype(np.uint8)
    veg = cv2.morphologyEx(veg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, ce = cv2.connectedComponentsWithStats(veg, 8)
    best, rows = None, []
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA] / S / S
        if a < 5:
            continue
        rows.append((a, X0 + ce[i][0] / S, Z0 + ce[i][1] / S, i))
    rows.sort(reverse=True)
    for a, cx, cz, i in rows:
        print(f"  turf component {a:7.1f} m² at ({cx:.1f}, {cz:.1f})")
    if not rows:
        return
    best = rows[0]
    cnts, _ = cv2.findContours((lab == best[3]).astype(np.uint8), cv2.RETR_EXTERNAL,
                               cv2.CHAIN_APPROX_SIMPLE)
    c = max(cnts, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 0.5 * S, True).reshape(-1, 2)
    pts = [[round(X0 + p[0] / S, 2), round(Z0 + p[1] / S, 2)] for p in poly]
    mask = np.zeros(shape, np.uint8)
    cv2.fillPoly(mask, [poly], 255)
    inside = cv2.erode(mask, np.ones((7, 7), np.uint8))
    med = np.median(im3[inside > 0], axis=0)
    frac = float((veg[mask > 0] > 0).mean())
    hexof = lambda m: "#%02x%02x%02x" % (int(m[2]), int(m[1]), int(m[0]))
    print(f"  turf polygon {len(pts)} vertices, {best[0]:.1f} m² component, "
          f"{frac * 100:.1f}% of the traced polygon is vegetation in ref3, "
          f"median {hexof(med)}")

    # CORROBORATION, stated as a number rather than as an adjective. The
    # previous pass claimed ref8 confirmed this panel "to 1.5 m"; sampled, the
    # same polygon in ref8 lands on pavement. Search the offset that maximises
    # ref8's vegetation fraction and report BOTH the fraction at zero offset
    # and the best offset, so the claim is checkable either way.
    out = {"host": "courtyard-2369", "frames": ["ref3"], "component_m2": round(best[0], 1),
           "vegetation_fraction_ref3": round(frac, 3), "colour_ref3": hexof(med), "points": pts}
    if os.path.exists(f"{OUT}/ortho-ref8.png"):
        im8 = read_ortho(cv2, "ref8")
        b8, g8 = im8[:, :, 0].astype(np.int16), im8[:, :, 1].astype(np.int16)
        veg8 = ((g8 - b8) > GREEN_OVER_BLUE).astype(np.uint8)
        at = lambda dx, dz: float(veg8[np.roll(np.roll(mask, -int(dz * S), 0), -int(dx * S), 1) > 0].mean())
        f0 = at(0, 0)
        grid = [(at(dx / 2, dz / 2), dx / 2, dz / 2) for dx in range(-12, 13) for dz in range(-12, 13)]
        bestoff = max(grid)
        print(f"  turf in ref8: vegetation fraction {f0 * 100:.1f}% at zero offset, "
              f"best {bestoff[0] * 100:.1f}% at ({bestoff[1]:+.1f}, {bestoff[2]:+.1f}) m")
        med8 = np.median(im8[inside > 0], axis=0)
        out.update({"vegetation_fraction_ref8": round(f0, 3), "colour_ref8": hexof(med8),
                    "ref8_best_offset_m": [bestoff[1], bestoff[2]],
                    "ref8_best_fraction": round(bestoff[0], 3)})
    write_report("turf-panel.json", out)


def pass_colours(cv2, W):
    """Every hex the furniture module ships, plus the illumination it was read in.

    A median taken in blue-cast shadow is an ILLUMINATION, not an albedo. The
    shade-to-sun ratio is measured here on the ONE material photographed in
    both states inside this frame — surveyed `walk` paving — so a shadow-cast
    read can be corrected instead of shipped raw as a black splat.
    """
    im3 = read_ortho(cv2, "ref3")
    shape = im3.shape[:2]
    arc = arcgis()
    walk = layer_mask(arc, "ground", {"walk"}, shape)
    b, g, r = (im3[:, :, i].astype(np.int16) for i in range(3))
    lum = cv2.cvtColor(im3, cv2.COLOR_BGR2GRAY).astype(np.float32)
    shade = (b - r) > 4          # the cast is blue: blue over red splits it
    lit = (walk > 0) & (~shade) & (lum > 0)
    dark = (walk > 0) & shade & (lum > 0)
    ratio = float(np.median(lum[lit]) / np.median(lum[dark]))
    print(f"  shade->sun ratio on surveyed paving: {ratio:.2f}x "
          f"(sun {np.median(lum[lit]):.0f}, shade {np.median(lum[dark]):.0f}, "
          f"n {int(lit.sum())}/{int(dark.sum())})")
    rep = {"frame": "ref3", "control": "surveyed walk paving",
           "split": "B-R > 4", "sun_luma": float(np.median(lum[lit])),
           "shade_luma": float(np.median(lum[dark])), "shade_to_sun": round(ratio, 3)}

    def hexof(m):
        return "#%02x%02x%02x" % (int(m[2]), int(m[1]), int(m[0]))

    def relight(m):
        """A shadow median, scaled to the sunlit state it was never seen in.

        The cast is BLUE, so the correction is per channel against the same
        control's own per-channel medians rather than one luminance factor —
        scaling all three equally would keep the blue cast and just make it a
        brighter blue, which is the failure being fixed.
        """
        v = [min(255.0, m[i] * float(np.median(im3[:, :, i][lit]) / max(np.median(im3[:, :, i][dark]), 1e-6)))
             for i in range(3)]
        return hexof(v)

    # The plaza objects, in their own detected footprints, and the enclosure.
    objs = json.load(open(f"{REPORT}/plaza-objects.json"))["objects"] \
        if os.path.exists(f"{REPORT}/plaza-objects.json") else []
    if objs:
        m = np.zeros(shape, np.uint8)
        for x, z, w, d in objs:
            cv2.rectangle(m, (int((x - w / 2 - X0) * S), int((z - d / 2 - Z0) * S)),
                          (int((x + w / 2 - X0) * S), int((z + d / 2 - Z0) * S)), 255, -1)
        raw = np.median(im3[m > 0], axis=0)
        state = "shade" if float(shade[m > 0].mean()) > 0.5 else "sun"
        rep["plazaObject"] = {"raw": hexof(raw), "state": state, "n": int((m > 0).sum()),
                              "ship": relight(raw) if state == "shade" else hexof(raw)}
        print(f"  plaza objects: raw {hexof(raw)} in {state} -> ships {rep['plazaObject']['ship']}")
    enc = f"{REPORT}/enclosure.json"
    if os.path.exists(enc):
        e = json.load(open(enc))
        im2 = read_ortho(cv2, "ref2")
        m = np.zeros(shape, np.uint8)
        cv2.rectangle(m, (int((e["cx"] - e["w"] / 2 - X0) * S), int((e["cz"] - e["d"] / 2 - Z0) * S)),
                      (int((e["cx"] + e["w"] / 2 - X0) * S), int((e["cz"] + e["d"] / 2 - Z0) * S)), 255, -1)
        raw = np.median(im2[m > 0], axis=0)
        b2, r2 = im2[:, :, 0].astype(np.int16), im2[:, :, 2].astype(np.int16)
        state = "shade" if float(((b2 - r2) > 4)[m > 0].mean()) > 0.5 else "sun"
        rep["enclosure"] = {"raw": hexof(raw), "state": state, "n": int((m > 0).sum()),
                            "ship": relight(raw) if state == "shade" else hexof(raw)}
        print(f"  enclosure: raw {hexof(raw)} in {state} -> ships {rep['enclosure']['ship']}")
    write_report("illumination.json", rep)


def pass_cobble(cv2, W):
    """The illumination-controlled bed/paving ratio test, per surveyed polygon.

    Bed luminance over the luminance of paving within 4 m of the SAME polygon
    IN THE SAME ILLUMINATION STATE. Controlling for the state is what makes it
    work: uncontrolled, the walkway CONTROL class scores 0.49-1.43 and separates
    nothing. Accepted as a dark material at ratio <= 0.80 over >= 1500 pixels.
    """
    im3 = read_ortho(cv2, "ref3")
    shape = im3.shape[:2]
    arc = arcgis()
    eighth = json.load(open("docs/data/campus-eighth.json"))
    walk = layer_mask(arc, "ground", {"walk"}, shape)
    lum = cv2.cvtColor(im3, cv2.COLOR_BGR2GRAY).astype(np.float32)
    b, r = im3[:, :, 0].astype(np.int16), im3[:, :, 2].astype(np.int16)
    shade = (b - r) > 4
    k4 = np.ones((int(8 * S) + 1, int(8 * S) + 1), np.uint8)
    rows = {}
    for key, feat in eighth["ground"].items():
        if feat.get("kind") not in ("planting-bed", "walkway"):
            continue
        m = np.zeros(shape, np.uint8)
        cv2.fillPoly(m, [ortho_px(feat["points"])], 255)
        m = cv2.erode(m, np.ones((5, 5), np.uint8))
        near = cv2.dilate(m, k4)
        best = None
        for state, sel in (("sun", ~shade), ("shade", shade)):
            bed = (m > 0) & sel & (lum > 0)
            ctl = (near > 0) & (m == 0) & (walk > 0) & sel & (lum > 0)
            if bed.sum() < 1500 or ctl.sum() < 500:
                continue
            q = float(np.median(lum[bed]) / max(np.median(lum[ctl]), 1e-6))
            if best is None or bed.sum() > best[1]:
                best = (q, int(bed.sum()), state)
        if best:
            rows[key] = {"ratio": round(best[0], 3), "n": best[1], "state": best[2],
                         "kind": feat["kind"]}
    beds = {k: v for k, v in rows.items() if v["kind"] == "planting-bed"}
    ctlq = sorted(v["ratio"] for v in rows.values() if v["kind"] == "walkway")
    if ctlq:
        mid = ctlq[len(ctlq) // 2]
        print(f"  control (walkway on walkway): median {mid:.3f} over {len(ctlq)} runs, "
              f"range {ctlq[0]:.2f}-{ctlq[-1]:.2f}")
    dark = sorted(((v["ratio"], k) for k, v in beds.items() if v["ratio"] <= 0.80 and v["n"] >= 1500))
    print(f"  beds measured {len(beds)}, accepted dark (<= 0.80) {len(dark)}")
    for q, k in dark:
        print(f'    ["{k}", {q:.3f}],')
    write_report("bed-ratios.json", {"accept": {"max_ratio": 0.80, "min_px": 1500},
                                     "beds": beds})


def write_report(name, obj):
    os.makedirs(REPORT, exist_ok=True)
    with open(f"{REPORT}/{name}", "w") as fh:
        json.dump(obj, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print(f"  wrote {REPORT}/{name}")


def main():
    import cv2
    ap = argparse.ArgumentParser()
    ap.add_argument("--overlay", action="store_true", help="project the survey back onto each frame")
    ap.add_argument("--ortho", action="store_true", help="warp the frames into a north-up metre grid")
    ap.add_argument("--furniture", action="store_true", help="re-derive the plaza objects and the enclosure")
    ap.add_argument("--turf", action="store_true", help="re-derive the turf panel contour and colour")
    ap.add_argument("--colours", action="store_true", help="re-derive the medians and the shade-to-sun ratio")
    ap.add_argument("--cobble", action="store_true", help="re-run the illumination-controlled bed ratio test")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    Hw, resid = world_to_ref2()
    print(f"ref2 anchor: max corner residual {resid:.2f} px = {resid / 10.9 * 100:.1f} cm")

    sift = cv2.SIFT_create(nfeatures=20000, contrastThreshold=0.02)
    BF = cv2.BFMatcher(cv2.NORM_L2)
    feats = {}

    def f(n):
        if n not in feats:
            g = cv2.cvtColor(cv2.imread(REFS + NAMES[n]), cv2.COLOR_BGR2GRAY)
            feats[n] = sift.detectAndCompute(g, None)
        return feats[n]

    def pair(src, dst):
        """H and the inlier count, over SEEDS fixed seeds to prove it is stable.

        WHY THE MATCHER IS BRUTE FORCE. This pass used to match through FLANN's
        randomised KD-forest, whose splits are drawn from flann's own RNG —
        which cv2.setRNGSeed does not reach. That made the MATCH SET, not just
        the RANSAC draw, different on every run: ref6 scored anywhere from 0 to
        29 inliers on identical input and its accept/reject decision flipped
        run to run, and the build report quoted the best draw it ever saw. An
        exhaustive L2 match is exact, costs under a second a pair at this size,
        and removes the randomness at its source instead of averaging over it.
        RANSAC is seeded on top of that, and the counts below are checked
        across SEEDS seeds so a residual wobble cannot hide.
        """
        ka, da = f(src)
        kb, db = f(dst)
        good = [m for m, n in BF.knnMatch(da, db, k=2) if m.distance < 0.75 * n.distance]
        if len(good) < 12:
            return None, 0, []
        s = np.float32([ka[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        d = np.float32([kb[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
        counts, H0 = [], None
        for seed in range(SEEDS):
            cv2.setRNGSeed(seed)
            H, mask = cv2.findHomography(s, d, cv2.RANSAC, 4.0, maxIters=20000, confidence=0.999)
            counts.append(int(mask.sum()) if mask is not None else 0)
            if seed == 0:
                H0 = H
        return H0, int(np.median(counts)), counts

    W = {"ref2": Hw}
    H23, n23, c23 = pair("ref2", "ref3")
    print(f"  ref2->ref3 median {n23} inliers over {SEEDS} seeds {c23}")
    if H23 is not None and n23 >= FLOOR:
        W["ref3"] = H23 @ Hw
    for b in ["ref8", "ref9", "ref1", "ref5", "ref6", "ref4", "ref7"]:
        best = None
        for src in [x for x in ("ref3", "ref2") if x in W]:
            H, n, cs = pair(src, b)
            print(f"  {src}->{b} median {n} inliers over {SEEDS} seeds {cs}")
            if H is not None and (best is None or n > best[1]):
                best = (H @ W[src], n)
        if best and best[1] >= FLOOR:
            W[b] = best[0]
        else:
            print(f"  {b}: REJECTED — median consensus below the {FLOOR}-inlier floor")
    np.savez(f"{OUT}/Hw.npz", **W)

    arc = arcgis()
    if a.overlay:
        col = {"green": (0, 255, 0), "walk": (0, 255, 255), "road": (255, 0, 255), "court": (0, 0, 255)}
        for n, H in W.items():
            im = cv2.imread(REFS + NAMES[n])
            for layer, colour in (("ground", None), ("massing", (255, 120, 0))):
                for g in arc.get(layer, []):
                    r = (g.get("r") or [None])[0]
                    if not r or len(r) < 3:
                        continue
                    w = np.array(r, float) / 10.0
                    p = (H @ np.hstack([w, np.ones((len(w), 1))]).T).T
                    p = (p[:, :2] / p[:, 2:3]).astype(np.int32)
                    cv2.polylines(im, [p], True, colour or col.get(g.get("k"), (255, 255, 255)), 1)
            cv2.imwrite(f"{OUT}/{n}-survey-overlay.png", im)
        print(f"  wrote {len(W)} survey overlays to {OUT} — EYEBALL THESE, they are the proof")

    if a.ortho:
        T = np.array([[S, 0, -X0 * S], [0, S, -Z0 * S], [0, 0, 1]], float)
        size = (int((-40 - X0) * S), int((690 - Z0) * S))
        for n, H in W.items():
            cv2.imwrite(f"{OUT}/ortho-{n}.png",
                        cv2.warpPerspective(cv2.imread(REFS + NAMES[n]), T @ np.linalg.inv(H), size))
        np.save(f"{OUT}/orthoT.npy", T)
        print(f"  wrote {len(W)} north-up orthos at {S} px/m over x {X0}..-40, z {Z0}..690")

    if a.furniture:
        pass_furniture(cv2, W)
    if a.turf:
        pass_turf(cv2, W)
    if a.colours:
        pass_colours(cv2, W)
    if a.cobble:
        pass_cobble(cv2, W)


if __name__ == "__main__":
    main()
