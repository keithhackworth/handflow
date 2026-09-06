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
            landmarks: [],
        }],
    });

    expect(frame1?.people[0]?.leftHand?.identityConfidence).toBeCloseTo(1 / evidenceWindow);

    const frame2 = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [],
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
            landmarks: [],
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
            landmarks: [],
        }],
    });

    const result = flow.process({
        timestamp: 133,
        hands: [{
            personId: "person-a",
            handedness: "right",
            handednessConfidence: 1,
            landmarks: [],
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
