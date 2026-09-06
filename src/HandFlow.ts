import type {
    Hand,
    HandFlowInput,
    HandFlowFrame,
    HandFlowOptions,
    Landmark,
    Person,
    Velocity3D,
    PendingHandSide,
    HandSideObservation,
} from "./types.js";

import {
    type HandFlowConfig,
    DEFAULT_HAND_FLOW_CONFIG
} from "./config.js";

export class HandFlow {
    private config: HandFlowConfig;

    private frameHistory: HandFlowFrame[] = [];


    constructor(options: Partial<HandFlowConfig> = {}) {
        this.config = {
            ...DEFAULT_HAND_FLOW_CONFIG,
            ...options,
        };
    }

    private handSideEvidence = new Map<string, HandSideObservation[]>();

    private resolveHandSide(
        handKey: string,
        detectedSide: Hand["side"],
        detectedConfidence: number,
    ): {
        side: Hand["side"];
        confidence: number;
    } {
        if (detectedSide === "unknown") {
            return {
                side: "unknown",
                confidence: 0,
            };
        }

        const evidence = this.handSideEvidence.get(handKey) ?? [];

        evidence.push({
            side: detectedSide,
            confidence: detectedConfidence,
        });

        if (evidence.length > this.config.handSideEvidenceWindow) {
            evidence.shift();
        }

        this.handSideEvidence.set(handKey, evidence);

        let leftScore = 0;
        let rightScore = 0;

        for (const observation of evidence) {
            if (observation.side === "left") {
                leftScore += observation.confidence;
            } else if (observation.side === "right") {
                rightScore += observation.confidence;
            }
        }

        const totalScore = leftScore + rightScore;

        if (totalScore === 0) {
            return {
                side: "unknown",
                confidence: 0,
            };
        }

        const voteConfidence = Math.max(leftScore, rightScore) / totalScore;

        const identityConfidence = evidence.length === 1
            ? voteConfidence / this.config.handSideEvidenceWindow
            : voteConfidence;

        if (leftScore >= rightScore) {
            return {
                side: "left",
                confidence: identityConfidence,
            };
        }
        
        return {
            side: "right",
            confidence: identityConfidence,
        };
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

    flush(): HandFlowFrame[] {
        const remainingFrames = [...this.outputBuffer];
        this.outputBuffer = [];

        return remainingFrames;
    }

    getHistory(): readonly HandFlowFrame[] {
        return this.frameHistory;
    }

    private outputBuffer: HandFlowFrame[] = [];

    process(input: HandFlowInput): HandFlowFrame | undefined {
        const people = new Map<string, Person>();

        for (const rawHand of input.hands) {
            const personId = rawHand.personId ?? "unassigned";

            const handKey = `${personId}`;

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

            const previousFrame = this.frameHistory[this.frameHistory.length - 1];

            const previousPerson = previousFrame?.people.find(
                (candidate) => candidate.id === personId,
            );


            const detectedSide = rawHand.handedness ?? "unknown";
            const detectedConfidence =
                rawHand.handednessConfidence ?? 0;
            
            const resolved = this.resolveHandSide(
                handKey,
                detectedSide,
                detectedConfidence,
            );

            const hand: Hand = {
                side: resolved.side,
                identityConfidence: resolved.confidence,
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

        if (this.frameHistory.length > this.config.historySize) {
            this.frameHistory.shift();
        }

        this.outputBuffer.push(result);

        if (this.outputBuffer.length <= this.config.framesDelay) {
            return undefined;
        }

        return this.outputBuffer.shift();
    }
}

