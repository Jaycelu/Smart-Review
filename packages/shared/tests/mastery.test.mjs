import test from "node:test";
import assert from "node:assert/strict";
import { calculateMasteryConfidence, passesMasteryGate } from "../dist/mastery.js";

const source = "Retrieval practice improves durable retention. Transfer requires applying knowledge to a new situation.";

function item(dimension, score, evidence, confidence = 0.9) {
  return {
    dimension,
    score,
    sourceEvidence: [evidence],
    referenceAnswer: "A grounded reference answer.",
    reason: "Evidence supports this score.",
    confidence
  };
}

function passingInitial() {
  return {
    items: [
      item("retention", 2, "Retrieval practice improves durable retention."),
      item("discrimination", 1, "Retrieval practice improves durable retention."),
      item("transfer", 2, "Transfer requires applying knowledge to a new situation."),
      item("generation", 1, "Transfer requires applying knowledge to a new situation.")
    ]
  };
}

test("passesMasteryGate enforces non-compensating initial thresholds", () => {
  assert.equal(passesMasteryGate("initial", passingInitial()), true);
  const failed = passingInitial();
  failed.items[2].score = 1;
  assert.equal(passesMasteryGate("initial", failed), false);
});

test("passesMasteryGate requires full retention and transfer on recheck", () => {
  assert.equal(passesMasteryGate("recheck", { items: [
    item("retention", 2, "Retrieval practice improves durable retention."),
    item("transfer", 2, "Transfer requires applying knowledge to a new situation.")
  ] }), true);
});

test("calculateMasteryConfidence is high for grounded identical independent grades", () => {
  const examiner = passingInitial();
  const verifier = passingInitial();
  assert.equal(calculateMasteryConfidence(examiner, verifier, source), "high");
});

test("calculateMasteryConfidence rejects ungrounded evidence and large disagreement", () => {
  const examiner = passingInitial();
  examiner.items[0].sourceEvidence = ["This sentence is not in the article."];
  assert.equal(calculateMasteryConfidence(examiner, passingInitial(), source), "low");

  const disagreeing = passingInitial();
  disagreeing.items[0].score = 0;
  assert.equal(calculateMasteryConfidence(passingInitial(), disagreeing, source), "low");
});
