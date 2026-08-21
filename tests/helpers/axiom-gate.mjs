/* The axiom-layer gate — R2 arbitration item S1, one apparatus for all six
 * Revelle R1 suites.
 *
 * WHY THIS FILE EXISTS. R1's derivation engine was real: every section carries
 * a `derivations.figures` table, every audit recomputed it by hand, and every
 * one reproduced. What nothing checked was the layer UNDERNEATH the figures —
 * the readings the figures derive FROM, the estimates they inherit, and the
 * `draw` blocks that carry numbers straight to the geometry. Move a reading
 * and every figure downstream moves with it, consistently, and passes. That is
 * not hypothetical: galbraith shipped `kda.rowPairToPair = 172.6`, an interval
 * that exists nowhere on the sheet it cites, with an invented waffle-slab story
 * built on top of it, and 60 gates passed. Five independent adversaries found
 * the same hole.
 *
 * Every function here is a TIGHTENING. A section that cannot pass one is
 * wrong. The only sanctioned escape is the per-section `uncovered` allowlist,
 * which is visible in the file and carries a reason string — never a widened
 * band and never a moved value.
 *
 * The six sections do not share a schema (argo keys figures by path with
 * {value, expr}; plaza and revelle carry prose strings; readings live at
 * `derivations.readings` in three sections and `derivations.reads` in two), so
 * every entry point here takes the shape it needs as an argument rather than
 * reaching into a section by a fixed path.
 */
import assert from "node:assert/strict";

/* ------------------------------------------------------------ small tools */

export const at = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

export function near(got, want, tol, msg) {
  assert.ok(
    typeof got === "number" && Math.abs(got - want) <= tol,
    `${msg}: got ${got}, want ${want} +/- ${tol}`,
  );
}

/* Every numeric leaf under `node`, as dotted paths rooted at `root`. Strings,
   booleans and nulls are not drawn numbers and are skipped; arrays are walked
   by index so a moved element is a moved path. */
export function numericLeaves(node, root, { exempt = {} } = {}) {
  const out = [];
  const walk = (v, p) => {
    if (exempt[p]) return;
    if (typeof v === "number") {
      out.push({ path: p, value: v });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${p}.${i}`));
      return;
    }
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
    }
  };
  walk(node, root);
  return out;
}

/* ------------------------------------------- S1(i): the coverage walk */

/* The pre-R2 walk covered the DRAWN blocks only. This one additionally walks
   the axiom layer — readings, estimates and draw — because that is where the
   fabrications that survived mutation testing were sitting.
 *
 * `classify(path, value)` returns a provenance string or null. `uncovered` is
 * the section's own allowlist: path -> reason. An allowlist entry that no
 * longer names an uncovered number is itself a failure, so the escape hatch
 * cannot rot open. */
export function assertCoverage({ section, roots, classify, uncovered = {}, minimum = 1, label = "section" }) {
  const paths = [];
  for (const [root, exempt] of Object.entries(roots)) {
    const node = at(section, root);
    if (node === undefined) continue;
    paths.push(...numericLeaves(node, root, { exempt: exempt || {} }));
  }
  assert.ok(
    paths.length >= minimum,
    `${label}: only ${paths.length} numbers found by the coverage walk, expected at least ${minimum} — the walk did not run`,
  );

  const used = new Set();
  for (const { path, value } of paths) {
    if (Object.prototype.hasOwnProperty.call(uncovered, path)) {
      used.add(path);
      assert.ok(
        typeof uncovered[path] === "string" && uncovered[path].length > 40,
        `${label}: ${path} is on the uncovered allowlist with no real reason`,
      );
      continue;
    }
    const where = classify(path, value);
    assert.ok(
      where,
      `${label}: ${path} = ${value} is a bare number in the axiom layer — derive it, band it, pin it to the artefact it is read off, or list it in \`uncovered\` with a reason`,
    );
  }

  for (const path of Object.keys(uncovered)) {
    assert.ok(
      used.has(path),
      `${label}: \`uncovered\` still allows ${path}, which the walk no longer finds — a stale exemption is an open door`,
    );
  }
  return paths;
}

/* ------------------------------------ S1(ii): machine-readable estimate bands */

/* An estimate whose only content is prose cannot be checked, and R1 shipped
   argo's `grid.floorToFloor` able to reach 2.25 m — 0.41 m outside the band the
   section itself published — with 28 gates passing. Every estimate now carries
   `band: [lo, hi]` (or an `expr`, handled by assertExprs) and the SHIPPED value
   must lie inside it. `extends` stays, but it is no longer the only content. */
export function assertEstimateBands({ estimates, valueAt, skip = [], label = "section" }) {
  const skipSet = new Set([...skip, "why", "note"]);
  let checked = 0;
  for (const [key, e] of Object.entries(estimates)) {
    if (skipSet.has(key)) continue;
    if (typeof e === "string") {
      assert.fail(`${label}: estimate ${key} is bare prose — it needs a value and a band`);
    }
    assert.ok(
      e.extends && e.extends.length > 25,
      `${label}: estimate ${key} must record which sourced pattern it extends`,
    );
    assert.ok(
      /\[estimated\]/.test(e.why || ""),
      `${label}: estimate ${key} must carry the [estimated] label`,
    );

    if (e.expr) { checked++; continue; }

    assert.ok(
      Array.isArray(e.band) && e.band.length === 2 &&
        typeof e.band[0] === "number" && typeof e.band[1] === "number",
      `${label}: estimate ${key} has no machine-readable band [lo, hi] — prose is not a band`,
    );
    const [lo, hi] = e.band;
    assert.ok(lo < hi, `${label}: estimate ${key} band is not ordered: [${lo}, ${hi}]`);
    assert.ok(
      typeof e.value === "number",
      `${label}: estimate ${key} carries a band but no numeric value`,
    );
    assert.ok(
      e.value >= lo && e.value <= hi,
      `${label}: estimate ${key} states ${e.value}, outside its own published band [${lo}, ${hi}]`,
    );
    const shipped = valueAt(key);
    assert.ok(
      typeof shipped === "number" && Math.abs(shipped - e.value) <= 5e-6,
      `${label}: estimate ${key} ships ${shipped} but states ${e.value}`,
    );
    assert.ok(
      shipped >= lo && shipped <= hi,
      `${label}: ${key} ships ${shipped}, outside its own published band [${lo}, ${hi}]`,
    );
    checked++;
  }
  assert.ok(checked > 0, `${label}: no estimates were banded — the gate did not run`);
  return checked;
}

/* -------------------------------- S1(iii): readings pinned to external truth */

/* A reading with an external truth — a code clause, a published count, a
   drawing scale, a pixel read off a cached frame — is pinned here to a literal,
   the way york already pins its 35 arcade columns. The literal lives in the
   TEST, so moving the reading in the section moves it away from the pin and
   fails.
 *
 * `pins` is path -> {value, tol, truth}. `namespaces` names the reading
 * sub-trees that must be pinned EXHAUSTIVELY, so a new unpinned reading cannot
 * be added to a pinned block without the gate noticing. */
export function assertPins({ readings, pins, namespaces = [], uncovered = {}, label = "section" }) {
  for (const [path, pin] of Object.entries(pins)) {
    const got = at(readings, path);
    assert.ok(
      got !== undefined,
      `${label}: pinned reading ${path} no longer exists — a pin whose subject vanished is not a pass`,
    );
    const want = typeof pin === "number" ? pin : pin.value;
    const tol = typeof pin === "number" ? 5e-6 : (pin.tol ?? 5e-6);
    const truth = typeof pin === "number" ? "" : (pin.truth || "");
    assert.ok(
      typeof pin === "number" || truth.length > 20,
      `${label}: pin ${path} must name the artefact it is pinned to`,
    );
    near(got, want, tol, `${label}: reading ${path} has moved off its external truth (${truth})`);
  }

  for (const ns of namespaces) {
    const node = at(readings, ns);
    if (node === undefined) continue;
    for (const { path } of numericLeaves(node, ns)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(pins, path) ||
          Object.prototype.hasOwnProperty.call(uncovered, path),
        `${label}: ${path} is a reading in a pinned block and it is not pinned — pin it to its artefact or list it in \`uncovered\``,
      );
    }
  }
  return Object.keys(pins).length;
}

/* A relation the section states in PROSE, asserted. blake's `px` block is a
   perfect arithmetic progression and the section knows it — `storeyStep: 137`
   is in the file — but nothing checked it, so any single member could be moved
   and every downstream figure re-derived consistently around the move. */
export function assertRelations({ relations, label = "section" }) {
  assert.ok(relations.length > 0, `${label}: no reading relations asserted`);
  for (const r of relations) {
    near(r.got, r.want, r.tol ?? 5e-6, `${label}: ${r.name}`);
  }
  return relations.length;
}

/* --------------------------------------------- S1(iv): the symmetric tier gate */

/* The R1 gate was one-directional: a `[measured]` line must not read like an
   estimate. This one also runs the other way — a line that extends a pattern,
   invents a look, has no per-hex sample record, or names no artefact at all
   MUST carry `[estimated]`, whatever it calls itself. This is the gate that
   catches a promotion: an [estimated] line acquiring a [measured] label because
   it cites the parent it extends. */
const HEDGES = [
  /\bextends\b/i,
  /invented look/i,
  /no per-hex sample record/i,
  /\bborrowed\b/i,
  /\bin kind\b/i,
  /nothing measures it/i,
  /not (?:re-?)?samplable/i,
];

/* An artefact citation: a cached file, a dated frame, an archive id, a
   published document, or a survey ring. */
const NAMES_ARTEFACT = [
  /\.(?:jpe?g|png|tif{1,2}|pdf|html|json|webp|JPG)\b/,
  /\b(?:19|20)\d{2}\b/,
  /arcgis\.(?:ground|massing)/,
  /campus-(?:lidar|3d|arcgis)\.json/,
  /\bDPR \d+/,
  /\bbb\d{6,}/,
  /photosphere|Street View|StreetView/i,
];

export function assertTierSymmetry({ entries, label = "section" }) {
  assert.ok(entries.length > 0, `${label}: the tier gate walked nothing`);
  for (const { key, text } of entries) {
    assert.ok(
      typeof text === "string" && text.length > 0,
      `${label}: ${key} carries no source string at all`,
    );
    const tier = /\[measured\]/.test(text)
      ? "measured"
      : /\[sourced\]/.test(text)
        ? "sourced"
        : /\[estimated\]/.test(text)
          ? "estimated"
          : /\[conflicted\]/.test(text)
            ? "conflicted"
            : null;
    assert.ok(tier, `${label}: ${key} carries no tier label`);
    if (tier === "estimated" || tier === "conflicted") continue;

    const hedge = HEDGES.find((re) => re.test(text));
    assert.ok(
      !hedge,
      `${label}: ${key} claims [${tier}] but its own source string hedges (${hedge}) — a line that extends, borrows or has no sample record is [estimated]`,
    );
    assert.ok(
      NAMES_ARTEFACT.some((re) => re.test(text)),
      `${label}: ${key} claims [${tier}] and names no artefact — a tier above [estimated] must say what was read`,
    );
  }
  return entries.length;
}

/* --------------------------------------------- S1(v): the per-entry absent gate */

/* `absent` was gated by LIST LENGTH, which cannot tell a retirement from a
   deletion and cannot notice a substitution. Each entry is now matched by a
   stable key. An entry may leave only by being BUILT (the surgeon says so
   here) or by being claimed in another section's `absent`. */
export function assertAbsentEntries({ absent, expected, built = {}, elsewhere = new Set(), label = "section" }) {
  const keyOf = (e) => (typeof e === "string" ? e : e.key || e.what || JSON.stringify(e));
  const have = new Map(absent.map((e) => [keyOf(e), e]));

  for (const [key, probe] of Object.entries(expected)) {
    const entry = have.get(key);
    if (!entry) {
      assert.ok(
        built[key] || elsewhere.has(key),
        `${label}: absent entry ${key} has disappeared and is neither built nor claimed in a sibling's absent list — a withholding may not leave silently`,
      );
      continue;
    }
    const text = typeof entry === "string" ? entry : JSON.stringify(entry);
    assert.match(text, probe, `${label}: absent entry ${key} no longer says what it withholds`);
  }

  for (const [key] of have) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(expected, key),
      `${label}: absent carries an entry this suite does not know about (${key}) — add it here with the probe that holds it`,
    );
  }
  return have.size;
}

/* -------------------------------------------- S1(vi): evaluate `expr` or delete it */

/* A derivation nobody runs is the Eighth lesson in a new costume. `expr` now
   means one thing only: an arithmetic formula over the section's own readings
   and figures, which is EVALUATED here and must reproduce the figure's own
   value. Where a derivation is genuinely prose it is carried under
   `derivation` instead, and the gate asserts it is not masquerading as an
   expression.
 *
 * The evaluator is deliberately tiny: dotted identifiers, decimal numbers, the
 * four operators, parentheses, and a short Math allowlist. Anything else is a
 * hard failure rather than a fallback, so an unevaluable string cannot slip
 * back in under the `expr` name. */
const TOKEN = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)|([-+*/(),])|(\S))/y;

export function evalExpr(expr, scope, label = "expr") {
  const idents = [];
  TOKEN.lastIndex = 0;
  let m;
  let js = "";
  while (TOKEN.lastIndex < expr.length) {
    const start = TOKEN.lastIndex;
    m = TOKEN.exec(expr);
    if (!m) {
      if (expr.slice(start).trim() === "") break;
      assert.fail(`${label}: cannot tokenise "${expr.slice(start, start + 30)}"`);
    }
    if (m[1]) js += m[1];
    else if (m[2]) {
      const name = m[2];
      if (/^(?:Math\.(?:min|max|abs|sqrt|round|floor|ceil|hypot|PI|sin|cos|tan|atan2))$/.test(name)) {
        js += name;
      } else {
        const v = at(scope, name);
        assert.ok(
          typeof v === "number" && Number.isFinite(v),
          `${label}: identifier \`${name}\` resolves to ${JSON.stringify(v)} — an expr referencing a reading that does not exist is a hard failure`,
        );
        idents.push(name);
        js += `(${v})`;
      }
    } else if (m[3]) js += m[3];
    else assert.fail(`${label}: illegal character \`${m[4]}\` in expr — \`expr\` is arithmetic, prose belongs in \`derivation\``);
  }
  assert.ok(idents.length > 0, `${label}: expr "${expr}" references no reading at all`);
  // eslint-disable-next-line no-new-func
  const out = Function(`"use strict"; return (${js});`)();
  assert.ok(Number.isFinite(out), `${label}: expr "${expr}" did not evaluate to a finite number`);
  return out;
}

export function assertExprs({ figures, scope, tol = 5e-6, label = "section" }) {
  let evaluated = 0;
  let prose = 0;
  for (const [key, decl] of Object.entries(figures)) {
    if (key === "why" || typeof decl === "string") { prose++; continue; }
    if (decl.expr === undefined) {
      assert.ok(
        decl.derivation && decl.derivation.length > 20,
        `${label}: figure ${key} has neither an evaluable \`expr\` nor a prose \`derivation\` — state how it was got`,
      );
      prose++;
      continue;
    }
    assert.ok(
      typeof decl.value === "number",
      `${label}: figure ${key} carries an expr and no numeric value to check it against`,
    );
    const got = evalExpr(decl.expr, scope, `${label}: ${key}`);
    near(got, decl.value, decl.exprTol ?? tol,
      `${label}: figure ${key}'s own expr does not reproduce its own value`);
    evaluated++;
  }
  assert.ok(evaluated > 0, `${label}: no expr was evaluated — the gate did not run`);
  return { evaluated, prose };
}

/* ------------------------------------------------------- S2: the sup gate */

/* `sup` meant two different things — a transfer to a named successor and a
   deletion on evidence — and only the prose could tell them apart. Every item
   carrying `sup` now declares which. A transfer needs a reciprocal claim in the
   successor; a deletion needs a stated ground. */
export function assertDispositions({ items, reciprocals = {}, label = "section" }) {
  assert.ok(items.length > 0, `${label}: no sup-carrying items were walked`);
  for (const it of items) {
    const { key, disposition, sup, detail } = it;
    assert.ok(
      disposition === "transferred" || disposition === "deleted-on-evidence",
      `${label}: ${key} carries \`sup\` and no \`disposition\` — a machine-readable field that reads as a transfer when the object was deleted says the opposite of what happened`,
    );
    if (disposition === "deleted-on-evidence") {
      assert.ok(
        detail && detail.length > 60,
        `${label}: ${key} is a deletion on evidence and states no ground`,
      );
      continue;
    }
    for (const successor of [].concat(sup)) {
      const rec = reciprocals[`${successor}:${key}`];
      assert.ok(
        rec,
        `${label}: ${key} declares a transfer to ${successor} and ${successor} carries no reciprocal claim — the revelle suite cannot otherwise detect a successor that has stopped shipping the object`,
      );
      assert.ok(
        rec.ships,
        `${label}: ${successor} claims ${key} and ships nothing for it`,
      );
      if (rec.countChange) {
        assert.equal(
          typeof rec.count, "number",
          `${label}: ${key} transferred with a count change and the reduction is only in prose`,
        );
      }
    }
  }
  return items.length;
}
