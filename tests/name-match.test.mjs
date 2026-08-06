import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namesMatch, nameTokens } from "../docs/js/name-match.js";

describe("namesMatch — abbrev / punct twin identity", () => {
  it("matches Canyonview Rec/ vs Recreation & (the class that double-rendered)", () => {
    assert.equal(
      namesMatch(
        "Canyonview Rec/Athletics Administration",
        "Canyonview Recreation & Athletics Administration",
      ),
      true,
    );
    assert.deepEqual(nameTokens("Canyonview Rec/Athletics Administration"), [
      "canyonview", "recreation", "athletics", "administration",
    ]);
  });

  it("still matches the One Miramar case-fold twin", () => {
    assert.equal(
      namesMatch("One Miramar Street, building 3", "One Miramar Street, Building 3"),
      true,
    );
  });

  it("matches punctuation-only twins (IGPP dash vs comma)", () => {
    assert.equal(
      namesMatch("IGPP - Munk Laboratory", "IGPP, Munk Laboratory"),
      true,
    );
  });

  it("does NOT equate Humanities and/& — different buildings share the phrase", () => {
    /* GIS L2 wing vs OSM tower. Dropping the stop-word "and" would make
       them match and the ≥0.85 area test would suppress the tower. */
    assert.equal(
      namesMatch("Humanities and Social Sciences", "Humanities & Social Sciences"),
      false,
    );
  });

  it("does NOT equate Design and/& (already resolved by centroid containment)", () => {
    assert.equal(
      namesMatch("Design and Innovation Building", "Design & Innovation Building"),
      false,
    );
  });

  it("does not match a bare letter against a compound (suffix rule's job)", () => {
    assert.equal(namesMatch("Matthews Apartments E", "E"), false);
  });
});
