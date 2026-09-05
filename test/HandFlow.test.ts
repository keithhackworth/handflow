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
});
