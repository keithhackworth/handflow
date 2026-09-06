import type {
    Hand,
    HandFlowInput,
    HandFlowFrame,
    HandFlowOptions,
    Landmark,
    Person,
    Velocity3D,
} from "./types.js";


export class HandFlow {
    private framesDelay: number;
    private frameHistory: HandFlowFrame[] = [];
    private historySize = 3;

    constructor(options: HandFlowOptions = {}) {
        this.framesDelay = Math.max(0, options.framesDelay ?? 0);
    }

    private calculateVelocity(
        previous: Landmark,
        current: Landmark,
        previousTimestamp: number,
        currentTimestamp: number,
    ): Velocity3D {
        const elapsedMs = currentTimestamp - previousTimestamp;

        if (elapsedMs <= 0) {
            return { x: 0, y: 0, z: 0 };
        }

        const seconds = elapsedMs / 1000;

        return {
            x: (current.position.x - previous.position.x) / seconds,
            y: (current.position.y - previous.position.y) / seconds,
            z: (current.position.z - previous.position.z) / seconds,
        };
    }

    getHistory(): readonly HandFlowFrame[] {
        return this.frameHistory;
    }

    process(input: HandFlowInput): HandFlowFrame | undefined {
        const people = new Map<string, Person>();

        for (const rawHand of input.hands) {
            const personId = rawHand.personId ?? "unassigned";

            let person = people.get(personId);

            if (!person) {
                person = {
                    id: personId,
                };

                people.set(personId, person);
            }

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

        const result: HandFlowFrame = {
            people: Array.from(people.values()),
            timestamp: input.timestamp,
        };


        this.frameHistory.push(result);

        if (this.frameHistory.length > this.historySize) {
            this.frameHistory.shift();
        }

        //if (this.frameHistory.length <= this.framesDelay) {
            //return undefined;
        //}
        //
        //return this.frameHistory[
            //this.frameHistory.length - this.framesDelay - 1
        //];

        return result;
    }
}

