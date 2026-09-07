import { describe, expect, it } from "vitest";
import { HandFlow } from "../src/HandFlow.js";
import { DEFAULT_HAND_FLOW_CONFIG } from "../src/config.js";

const evidenceWindow = DEFAULT_HAND_FLOW_CONFIG.handSideEvidenceWindow;

describe("HandFlow", () => {
    it("converts a raw observed hand into a HandFlow result", () => {
        const flow = new HandFlow();

        const input = {
            hands: [
                {
                    handedness: "left" as const,
                    handednessConfidence: 0.95,
                    landmarks: [
                        {
                            x: 0.5,
                            y: 0.25,
                            z: -0.1,
                            confidence: 0.98,
                        },
                    ],
                },
            ],
            timestamp: 100,
        };

        const result = flow.process(input);

        if (result) {
            expect(result.people).toHaveLength(1);
    
            const leftHand = result.people[0]?.leftHand;
    
            expect(leftHand?.side).toBe("left");
            expect(leftHand?.identityConfidence).toBeCloseTo(1 / evidenceWindow);
            expect(leftHand?.landmarks[0]).toStrictEqual({
                position: {
                    x: 0.5,
                    y: 0.25,
                    z: -0.1,
                },
                confidence: 0.98,
                source: "observed",
            });
        }
    });
    it("groups hands by detector person ID", () => {
        const flow = new HandFlow();
    
        const input = {
            timestamp: 200,
            hands: [
                {
                    personId: "person-a",
                    handedness: "left" as const,
                    landmarks: [],
                },
                {
                    personId: "person-b",
                    handedness: "right" as const,
                    landmarks: [],
                },
            ],
        };
    
        const frame = flow.process(input);
    
        if (frame) {
            expect(frame.people).toHaveLength(2);
            expect(frame.people[0]?.id).toBe("person-a");
            expect(frame.people[1]?.id).toBe("person-b");
        }
    });
});

it("keeps only the most recent three frame results", () => {
    const flow = new HandFlow({
        framesDelay: 2,
    });

    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "frame-1",
                handedness: "left",
                landmarks: [],
            },
        ],
    });

    flow.process({
        timestamp: 133,
        hands: [
            {
                personId: "frame-2",
                handedness: "left",
                landmarks: [],
            },
        ],
    });

    flow.process({
        timestamp: 166,
        hands: [
            {
                personId: "frame-3",
                handedness: "left",
                landmarks: [],
            },
        ],
    });

    flow.process({
        timestamp: 199,
        hands: [
            {
                personId: "frame-4",
                handedness: "left",
                landmarks: [],
            },
        ],
    });

    const history = flow.getHistory();

    expect(history).toHaveLength(3);
    expect(history[0]?.people[0]?.id).toBe("frame-2");
    expect(history[1]?.people[0]?.id).toBe("frame-3");
    expect(history[2]?.people[0]?.id).toBe("frame-4");
});

it("delays output by the configured number of frames", () => {
    const flow = new HandFlow({
        framesDelay: 2,
    });

    const frame1 = flow.process({ timestamp: 100, hands: [] });
    const frame2 = flow.process({ timestamp: 133, hands: [] });
    const frame3 = flow.process({ timestamp: 166, hands: [] });

    expect(frame1).toBeUndefined();
    expect(frame2).toBeUndefined();
    expect(frame3?.timestamp).toBe(100);
});

it("flushes remaining delayed frames", () => {
    const flow = new HandFlow({
        framesDelay: 2,
    });

    flow.process({ timestamp: 100, hands: [] });
    flow.process({ timestamp: 133, hands: [] });
    flow.process({ timestamp: 166, hands: [] });
    flow.process({ timestamp: 199, hands: [] });

    const remaining = flow.flush();

    expect(remaining.map((frame) => frame.timestamp))
        .toStrictEqual([166, 199]);

    expect(flow.flush()).toStrictEqual([]);
});

it("does not immediately flip hand identity", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 0.98,
                landmarks: [],
            },
        ],
    });

    const result = flow.process({
        timestamp: 133,
        hands: [
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 0.95,
                landmarks: [],
            },
        ],
    });

    expect(result?.people[0]?.leftHand?.side).toBe("left");
});

it("accepts a handedness change after repeated confirmation", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 0.98,
            landmarks: [],
        }],
    });

    flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 0.95,
            landmarks: [],
        }],
    });

    flow.process({
        timestamp: 166,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 0.96,
            landmarks: [],
        }],
    });

    const result = flow.process({
        timestamp: 199,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 0.97,
            landmarks: [],
        }],
    });

    expect(result?.people[0]?.rightHand?.side).toBe("right");
});

it("clears a pending handedness change when the detector returns to the original side", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 0.98,
            landmarks: [],
        }],
    });

    const result_mid = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 0.95,
            landmarks: [],
        }],
    });

    expect(result_mid?.people[0]?.leftHand?.side).toBe("left");

    const result = flow.process({
        timestamp: 166,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 0.97,
            landmarks: [],
        }],
    });

    expect(result?.people[0]?.leftHand?.side).toBe("left");
    expect(result?.people[0]?.leftHand?.identityConfidence).toBeGreaterThan(0.5);
});

it("builds handedness confidence across initial frames", () => {
    const flow = new HandFlow();

    const frame1 = flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [
                { x: 0.25, y: 0.5, z: 0 },
            ],
        }],
    });

    expect(frame1?.people[0]?.leftHand?.identityConfidence).toBeCloseTo(1 / evidenceWindow);

    const frame2 = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [{ x: 0.26, y: 0.5, z: 0 },],
        }],
    });

    expect(frame2?.people[0]?.leftHand?.identityConfidence)
        .toBeCloseTo(1 / 2);

    const frame3 = flow.process({
        timestamp: 166,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [{ x: 0.27, y: 0.5, z: 0 }],
        }],
    });

    expect(frame3?.people[0]?.rightHand?.identityConfidence).toBeCloseTo(2 / evidenceWindow);
});

it("changes to right when two of three observations are right", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [],
        }],
    });

    flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [],
        }],
    });

    const result = flow.process({
        timestamp: 166,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [],
        }],
    });

    expect(result?.people[0]?.rightHand?.side).toBe("right");
    expect(result?.people[0]?.rightHand?.identityConfidence).toBeCloseTo(2 / evidenceWindow);
});

it("is ambiguous after one left and one right observation", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [
                { x: 0.25, y: 0.5, z: 0 },
            ],
        }],
    });

    const result = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [
                { x: 0.26, y: 0.5, z: 0 },
            ],
        }],
    });

    expect(result?.people[0]?.leftHand?.side).toBe("left");

    expect(result?.people[0]?.leftHand?.identityConfidence)
        .toBeCloseTo(0.5);
});

it("returns to left with reduced confidence after left-right-left", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [],
        }],
    });

    flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [],
        }],
    });

    const result = flow.process({
        timestamp: 166,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [],
        }],
    });

    expect(result?.people[0]?.leftHand?.side).toBe("left");
    expect(result?.people[0]?.leftHand?.identityConfidence).toBeCloseTo(2 / evidenceWindow);
});

it("preserves physical hand identity when detector handedness labels swap", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [{ x: 0.2, y: 0.5, z: 0 }],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [{ x: 0.8, y: 0.5, z: 0 }],
            },
        ],
    });

    const result = flow.process({
        timestamp: 133,
        hands: [
            {
                personId: "person-a",
                handedness: "right", // detector got this wrong
                handednessConfidence: 1,
                landmarks: [{ x: 0.21, y: 0.5, z: 0 }],
            },
            {
                personId: "person-a",
                handedness: "left", // detector got this wrong
                handednessConfidence: 1,
                landmarks: [{ x: 0.79, y: 0.5, z: 0 }],
            },
        ],
    });

    expect(result?.people[0]?.leftHand?.landmarks[0]?.position.x)
        .toBeCloseTo(0.21);

    expect(result?.people[0]?.rightHand?.landmarks[0]?.position.x)
        .toBeCloseTo(0.79);
});

it("resets hand identity evidence when two hands become ambiguous", () => {
    // establish left and right with high confidence

    // move both hands close enough that matching is ambiguous

    // separate them again

    // first clear frame should assign probable identities
    // but confidence should be back near startup confidence
});

it("preserves right identity when handedness evidence is tied", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [{ x: 0.75, y: 0.5, z: 0 }],
        }],
    });

    const result = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [{ x: 0.74, y: 0.5, z: 0 }],
        }],
    });

    expect(result?.people[0]?.rightHand?.side).toBe("right");
    expect(result?.people[0]?.rightHand?.identityConfidence)
        .toBeCloseTo(0.5);
});

it("weights handedness evidence by detector confidence", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [{
            personId: "person-a",
            handedness: "left",
            handednessConfidence: 1,
            landmarks: [{ x: 0.25, y: 0.5, z: 0 }],
        }],
    });

    const result = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 0.25,
            landmarks: [{ x: 0.26, y: 0.5, z: 0 }],
        }],
    });

    expect(result?.people[0]?.leftHand?.side).toBe("left");
    expect(result?.people[0]?.leftHand?.identityConfidence)
        .toBeCloseTo(0.8);
});

it("preserves hand identity when close hands have clear trajectories", () => {
    const flow = new HandFlow();

    // Establish identities.
    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.20, y: 0.50, z: 0 },
                    { x: 0.30, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.70, y: 0.50, z: 0 },
                    { x: 0.80, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Establish clear trajectories toward each other.
    flow.process({
        timestamp: 200,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.30, y: 0.50, z: 0 },
                    { x: 0.40, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.60, y: 0.50, z: 0 },
                    { x: 0.70, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Centers are .50 and .52.
    // Hand length is about .10.
    //
    // Separation = .02 / .10 = .20 hand lengths.
    //
    // This IS inside our .25 ambiguity threshold.
    flow.process({
        timestamp: 300,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.44, y: 0.50, z: 0 },
                    { x: 0.54, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.46, y: 0.50, z: 0 },
                    { x: 0.56, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Move apart again.
    const result = flow.process({
        timestamp: 400,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.40, y: 0.50, z: 0 },
                    { x: 0.50, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.50, y: 0.50, z: 0 },
                    { x: 0.60, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(result?.people[0]?.leftHand?.identityConfidence)
        .toBeGreaterThan(1 / 3);

    expect(result?.people[0]?.rightHand?.identityConfidence)
        .toBeGreaterThan(1 / 3);
});

it("preserves hand identity when close hands have strong thumb-side evidence", () => {
    const flow = new HandFlow();

    // Establish identities.
    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "left",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.20, y: 0.50, z: 0 },
                    { x: 0.30, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "right",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.70, y: 0.50, z: 0 },
                    { x: 0.80, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Second stable frame builds confidence, but no useful motion.
    flow.process({
        timestamp: 200,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "left",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.20, y: 0.50, z: 0 },
                    { x: 0.30, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "right",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.70, y: 0.50, z: 0 },
                    { x: 0.80, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Suddenly close together. Previous velocity was basically zero,
    // so trajectory should not be enough to rescue identity.
    flow.process({
        timestamp: 300,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "left",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.44, y: 0.50, z: 0 },
                    { x: 0.54, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "right",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.46, y: 0.50, z: 0 },
                    { x: 0.56, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    const result = flow.process({
        timestamp: 400,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "left",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.30, y: 0.50, z: 0 },
                    { x: 0.40, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                thumbSideEvidence: {
                    side: "right",
                    confidence: 1,
                },
                landmarks: [
                    { x: 0.60, y: 0.50, z: 0 },
                    { x: 0.70, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(result?.people[0]?.leftHand?.identityConfidence)
        .toBeGreaterThan(1 / 3);

    expect(result?.people[0]?.rightHand?.identityConfidence)
        .toBeGreaterThan(1 / 3);
});

it("preserves the missing physical hand identity when one hand disappears and reappears", () => {
    const flow = new HandFlow();

    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.20, y: 0.50, z: 0 },
                    { x: 0.30, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.70, y: 0.50, z: 0 },
                    { x: 0.80, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    flow.process({
        timestamp: 200,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.22, y: 0.50, z: 0 },
                    { x: 0.32, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.68, y: 0.50, z: 0 },
                    { x: 0.78, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Right hand disappears.
    const missingFrame = flow.process({
        timestamp: 300,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.24, y: 0.50, z: 0 },
                    { x: 0.34, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(missingFrame?.people[0]?.leftHand)
        .toBeDefined();

    expect(missingFrame?.people[0]?.rightHand)
        .toBeUndefined();

    // Right hand disappears.
    const missingFrame2 = flow.process({
        timestamp: 400,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.28, y: 0.50, z: 0 },
                    { x: 0.38, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(missingFrame2?.people[0]?.leftHand)
        .toBeDefined();

    expect(missingFrame2?.people[0]?.rightHand)
        .toBeUndefined();


    // Right hand reappears.
    const recoveredFrame = flow.process({
        timestamp: 500,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.26, y: 0.50, z: 0 },
                    { x: 0.36, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.50, y: 0.50, z: 0 },
                    { x: 0.60, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(recoveredFrame?.people[0]?.leftHand)
        .toBeDefined();

    expect(recoveredFrame?.people[0]?.rightHand)
        .toBeDefined();

    expect(
        recoveredFrame?.people[0]?.rightHand?.identityConfidence,
    ).toBeGreaterThan(1 / 3);
});

it("does not let a visible hand steal the identity of a missing hand", () => {
    const flow = new HandFlow();

    // Establish two physical hand identities.
    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.20, y: 0.50, z: 0 },
                    { x: 0.30, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.70, y: 0.50, z: 0 },
                    { x: 0.80, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Both hands move slightly inward.
    flow.process({
        timestamp: 200,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.22, y: 0.50, z: 0 },
                    { x: 0.32, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.68, y: 0.50, z: 0 },
                    { x: 0.78, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Right hand disappears.
    // Left hand keeps moving toward the right-hand track.
    const frame300 = flow.process({
        timestamp: 300,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.40, y: 0.50, z: 0 },
                    { x: 0.50, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(frame300?.people[0]?.leftHand)
        .toBeDefined();

    expect(frame300?.people[0]?.rightHand)
        .toBeUndefined();

    // Left hand is now closer to the stale right-hand track
    // than it is to its own previous position.
    const frame400 = flow.process({
        timestamp: 400,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.55, y: 0.50, z: 0 },
                    { x: 0.65, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // This is the behavior we WANT.
    // The visible physical left hand should remain left,
    // even though nearest-neighbor geometry favors the stale right track.
    expect(frame400?.people[0]?.leftHand)
        .toBeDefined();

    expect(frame400?.people[0]?.rightHand)
        .toBeUndefined();

    // Missing right hand reappears on the other side.
    const recoveredFrame = flow.process({
        timestamp: 500,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.57, y: 0.50, z: 0 },
                    { x: 0.67, y: 0.50, z: 0 },
                ],
            },
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.45, y: 0.50, z: 0 },
                    { x: 0.55, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    expect(recoveredFrame?.people[0]?.leftHand)
        .toBeDefined();

    expect(recoveredFrame?.people[0]?.rightHand)
        .toBeDefined();

    expect(
        recoveredFrame?.people[0]?.leftHand?.identityConfidence,
    ).toBeGreaterThan(1 / 3);

    expect(
        recoveredFrame?.people[0]?.rightHand?.identityConfidence,
    ).toBeGreaterThan(1 / 3);
});

it("treats detector handedness disagreement as evidence, not a hard veto", () => {
    const flow = new HandFlow();

    // Establish a left-hand track around x=.25.
    flow.process({
        timestamp: 100,
        hands: [
            {
                personId: "person-a",
                handedness: "left",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.20, y: 0.50, z: 0 },
                    { x: 0.30, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // Same physical hand, slightly moved,
    // but detector incorrectly reports RIGHT with high confidence.
    const result = flow.process({
        timestamp: 200,
        hands: [
            {
                personId: "person-a",
                handedness: "right",
                handednessConfidence: 1,
                landmarks: [
                    { x: 0.22, y: 0.50, z: 0 },
                    { x: 0.32, y: 0.50, z: 0 },
                ],
            },
        ],
    });

    // HandFlow should preserve the physical track.
    // The handedness evidence is now tied L/R, so previous side wins.
    expect(result?.people[0]?.leftHand)
        .toBeDefined();

    expect(result?.people[0]?.rightHand)
        .toBeUndefined();

    expect(
        result?.people[0]?.leftHand?.side,
    ).toBe("left");

    expect(
        result?.people[0]?.leftHand?.identityConfidence,
    ).toBeCloseTo(0.5);
});

