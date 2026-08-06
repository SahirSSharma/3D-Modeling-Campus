# Walk it: http://localhost:5170

Spawns 110 m over Argo Hall looking north, at survey speed.

| | |
|---|---|
| **look** | drag |
| **move** | W / S, or A / D |
| **up / down** | Q / E |
| **speed** | ↑ ↓ coarse, ← → fine (starts at 500 m/s — wind it down to walk) |
| **labels** | L |
| **teleport** | click the minimap, or use the place list |

---

## What the gate says before you start

**99.1% of the campus footprint inside the boundary is measured** — 485 buildings,
641,079 m². Everything else below is the 0.91%.

| | check | measured |
|---|---|---|
| ✅ | no mass buried in its own hill | 0 of 1,365 |
| ✅ | first-check landmarks standing | Geisel 33.8 m · Argo 18.7 · Blake 12.4 · RIMAC 16.6 |
| ✅ | eye-level frame rate | 120 fps on the M4 |
| ✅ | console errors | 0 |
| ✅ | data reproduces from its builders | `npm run check` exit 0 |
| ⬜ | named buildings on a guess | **1** — Hyatt Regency, off campus |
| ⬜ | on-campus rings on a guess | **27**, 0.91% of footprint |

The two red rows are listed honestly rather than argued away. Both are below.

---

## Named hard cases — the things worth your attention first

These are this project's own regression cases. If any of them reads wrong at eye
level, that outranks everything in the backlog.

1. **The Voigt Dr / Ridge Walk / Hopkins Dr hill.** A real, sizeable grade.
   Walk it corner to corner and check buildings and paths follow it instead of
   sitting flat.
2. **Argo Hall and Blake Hall.** The first two heights anyone checks. OSM
   claimed Argo at 22.8 m; the LiDAR says 18.4.
3. **RIMAC's four pitches.** One was missing entirely until it was caught; the
   north-east pitch is deliberately unpainted because the fit would not clear
   its gate.
4. **Warren Mall's stairs and terracing.**
5. **Geisel.** Stacked from real per-floor polygons, not one slab.

---

## Known imperfect — so you can tell a bug from a documented gap

**The Marshall Lower Apartments cluster** (Scholars Drive North).
`osm:17, 131, 140, 188, 882, 884` render at a 4.5 m default. Apple imagery at
z19/z20 shows one- to two-storey flat-roofed apartments under mature eucalyptus
whose crowns overhang the roofs. The 2014 LiDAR reads 5.4–11.8 m there because
it cannot separate roof from crown — fewer than half the returns fall in any
2 m band. **Withheld on purpose:** admitting those numbers would stand an 11 m
block where a one-storey apartment is. If they look about a storey tall, that is
the intended state.

**osm:899**, a service-yard shed off Gilman Drive. Reads 15 m off the point
cloud on a 121 m² footprint; the ring overlay shows a single-storey flat roof
and the 15 m is bleed off the taller building north of it. Withheld.

**The other 20 on-campus rings.** Median 178 m², 20 of 27 under 250 m² — sheds,
kiosks, utility structures. Each is refused for a recorded reason: too few
returns, past the survey edge, or a site that predates the 2014 flight.

**The Hyatt Regency** is off campus and still on its OSM tag.

**Off campus generally.** 328 rings outside the boundary render at guesses —
Golden Triangle and Sorrento Valley office blocks on Nobel Drive and Genesee
Avenue. They fall inside the survey box, they are not campus, and no work on
them changes this walk.

---

## What would be most useful back from you

Not a bug list — the gates already cover what is checkable. What they cannot
check is whether it **reads like the place**:

- anywhere the ground feels wrong underfoot — a slope that should be there and is not
- a building whose height reads wrong at eye level, by name if you can
- anything that looks invented rather than measured
- anywhere you expected a building and found nothing

A named building that reads wrong is worth more than any number in this file.

---

_Server: `npm run serve` (port 5170). Gate: `npm run readiness`. Nothing has been
pushed — 71 commits sit unpushed on the branch, and shipping is your call._
