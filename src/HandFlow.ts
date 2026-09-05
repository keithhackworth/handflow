import type {
    Hand,
    HandFlowInput,
    HandFlowResult,
    Landmark,
} from "./types.js";

export class HandFlow {
    process(input: HandFlowInput): HandFlowResult {
        const person = {
            id: "person-1",
        } as {
            id: string;
            leftHand?: Hand;
            rightHand?: Hand;
        };

        for (const rawHand of input.hands) {
            const landmarks: Landmark[] = rawHand.landmarks.map((point) => ({
                position: {
                    x: point.x,
                    y: point.y,
                    z: point.z,
                },
                confidence: point.confidence ?? 1,
                source: "observed",
            }));

            const hand: Hand = {
                side: rawHand.handedness ?? "unknown",
                identityConfidence: rawHand.handednessConfidence ?? 0,
                landmarks,
            };

            if (hand.side === "left") {
                person.leftHand = hand;
            } else if (hand.side === "right") {
                person.rightHand = hand;
            }
        }

        return {
            people: input.hands.length > 0 ? [person] : [],
        };
    }
}

