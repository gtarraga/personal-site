import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLetterboxdUrl } from "./shelf-data.mjs";

test("normalizeLetterboxdUrl strips member path and trailing page segment", () => {
  assert.equal(
    normalizeLetterboxdUrl("https://letterboxd.com/miscerable/film/bugonia/2/"),
    "https://letterboxd.com/film/bugonia/"
  );
});

test("normalizeLetterboxdUrl leaves canonical film url alone", () => {
  assert.equal(
    normalizeLetterboxdUrl("https://letterboxd.com/film/bugonia/"),
    "https://letterboxd.com/film/bugonia/"
  );
});
