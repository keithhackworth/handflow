import { describe, expect, it } from "vitest";
import { HandFlow } from "../src/HandFlow.js";

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

        expect(result.people).toHaveLength(1);

        const leftHand = result.people[0]?.leftHand;

        expect(leftHand?.side).toBe("left");
        expect(leftHand?.identityConfidence).toBe(0.95);
        expect(leftHand?.landmarks[0]).toStrictEqual({
            position: {
                x: 0.5,
                y: 0.25,
                z: -0.1,
            },
            confidence: 0.98,
            source: "observed",
        });
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