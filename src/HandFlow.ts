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
    Point3D,
    TrackedHand,
    RawHandDetection,
} from "./types.js";

import {
    calculateHandSeparationInHandLengths,
    calculateDistance,
    calculateLandmarkCentroid,
    calculatePointVelocity,
    predictPoint,
    estimateHandLength,
} from "./motion.js";

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
    private trackedHands = new Map<string, TrackedHand>();
    private nextHandId = 1;

    private trajectorySupportsTrackedHand(
        trackedHand: TrackedHand,
        previousState: {
            centroid: Point3D;
            timestamp: number;
            velocity: Velocity3D;
        },
        observedCentroid: Point3D,
        timestamp: number,
        handLength: number,
    ): boolean {
        if (handLength <= 0) {
            return false;
        }

        const elapsedMs =
            timestamp - previousState.timestamp;

        if (elapsedMs <= 0) {
            return false;
        }

        const predicted = predictPoint(
            previousState.centroid,
            previousState.velocity,
            elapsedMs,
        );

        const predictionError =
            calculateDistance(
                predicted,
                observedCentroid,
            );

        const errorInHandLengths =
            predictionError / handLength;

        return errorInHandLengths <= 0.5;
    }

    private thumbEvidenceSupportsTrackedHand(
        trackedHand: TrackedHand,
        rawHand: RawHandDetection,
    ): boolean {
        const evidence = rawHand.thumbSideEvidence;

        if (!evidence) {
            return false;
        }

        if (evidence.side === "unknown") {
            return false;
        }

        if (trackedHand.side === "unknown") {
            return false;
        }

        return (
            evidence.side === trackedHand.side &&
            evidence.confidence >= 0.7
        );
    }

    private resetHandSideEvidence(handKey: string): void {
        this.handSideEvidence.delete(handKey);
    }

    private resolveHandSide(
        handKey: string,
        previousSide: Hand["side"],
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

        if (leftScore > rightScore) {
            return {
                side: "left",
                confidence: identityConfidence,
            };
        }

        if (rightScore > leftScore) {
            return {
                side: "right",
                confidence: identityConfidence,
            };
        }

        if (previousSide !== "unknown") {
            return {
                side: previousSide,
                confidence: identityConfidence,
            };
        }

        return {
            side: "unknown",
            confidence: identityConfidence,
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
        const claimedHandIds = new Set<string>();

        const trackedHandIdsByPerson = new Map<string, string[]>();
        const rawHandByTrackedHandId = new Map<string, RawHandDetection>();
        const previousTrackedHandState = new Map<string, {
            centroid: Point3D;
            timestamp: number;
            velocity: Velocity3D;
        }>();

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

            const centroid = calculateLandmarkCentroid(landmarks);

            let trackedHand: TrackedHand | undefined;

            if (centroid) {
                trackedHand = this.findTrackedHand(
                    personId,
                    centroid,
                    rawHand,
                    claimedHandIds,
                );

                if (!trackedHand) {
                    trackedHand = this.createTrackedHand(
                        personId,
                        centroid,
                        input.timestamp,
                    );
                }

                if (trackedHand) {
                    rawHandByTrackedHandId.set(
                        trackedHand.id,
                        rawHand,
                    );
                }

                claimedHandIds.add(trackedHand.id);

                const personTrackedHandIds = trackedHandIdsByPerson.get(personId) ?? [];

                personTrackedHandIds.push(trackedHand.id);

                previousTrackedHandState.set(
                    trackedHand.id,
                    {
                        centroid: trackedHand.lastCentroid,
                        timestamp: trackedHand.lastSeenTimestamp,
                        velocity: trackedHand.velocity,
                    },
                );
                trackedHandIdsByPerson.set(
                    personId,
                    personTrackedHandIds,
                );

                const previousCentroid = trackedHand.lastCentroid;
                const previousTimestamp = trackedHand.lastSeenTimestamp;

                trackedHand.velocity = calculatePointVelocity(
                    previousCentroid,
                    centroid,
                    previousTimestamp,
                    input.timestamp,
                );

                trackedHand.lastCentroid = centroid;
                trackedHand.lastSeenTimestamp = input.timestamp;

            }

            const handKey = trackedHand?.id ?? personId;

            const detectedSide = rawHand.handedness ?? "unknown";
            const detectedConfidence =
                rawHand.handednessConfidence ?? 0;

            const resolved = this.resolveHandSide(
                handKey,
                trackedHand?.side ?? "unknown",
                detectedSide,
                detectedConfidence,
            );

            if (trackedHand) {
                trackedHand.side = resolved.side;
            }

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

        for (const [personId, person] of people) {
            const leftHand = person.leftHand;
            const rightHand = person.rightHand;

            if (!leftHand || !rightHand) {
                continue;
            }

            const separation =
                calculateHandSeparationInHandLengths(
                    leftHand.landmarks,
                    rightHand.landmarks,
                );

            const handednessIsAmbiguous =
                separation !== undefined &&
                separation <=
                this.config
                    .handednessMatchAmbiguityDistanceInHandLengths;

            if (handednessIsAmbiguous) {
                const trackedHandIds =
                    trackedHandIdsByPerson.get(personId) ?? [];

                let identityIsSupported = true;

                for (const handId of trackedHandIds) {
                    const trackedHand =
                        this.trackedHands.get(handId);

                    const previousState =
                        previousTrackedHandState.get(handId);

                    const rawHand =
                        rawHandByTrackedHandId.get(handId);

                    if (!trackedHand || !previousState || !rawHand) {
                        identityIsSupported = false;
                        break;
                    }

                    const hand =
                        trackedHand.side === "left"
                            ? person.leftHand
                            : trackedHand.side === "right"
                                ? person.rightHand
                                : undefined;

                    if (!hand) {
                        identityIsSupported = false;
                        break;
                    }

                    const centroid =
                        calculateLandmarkCentroid(
                            hand.landmarks,
                        );

                    const handLength =
                        estimateHandLength(
                            hand.landmarks,
                        );

                    if (!centroid || !handLength) {
                        identityIsSupported = false;
                        break;
                    }

                    const thumbSupportsIdentity =
                        this.thumbEvidenceSupportsTrackedHand(
                            trackedHand,
                            rawHand,
                        );

                    const trajectorySupportsIdentity =
                        this.trajectorySupportsTrackedHand(
                            trackedHand,
                            previousState,
                            centroid,
                            input.timestamp,
                            handLength,
                        );

                    if (
                        !thumbSupportsIdentity &&
                        !trajectorySupportsIdentity
                    ) {
                        identityIsSupported = false;
                        break;
                    }
                }

                if (!identityIsSupported) {
                    for (const handId of trackedHandIds) {
                        this.resetHandSideEvidence(handId);
                    }
                }
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

    private createTrackedHand(
        personId: string,
        centroid: Point3D,
        timestamp: number,
    ): TrackedHand {
        const trackedHand: TrackedHand = {
            id: `hand-${this.nextHandId++}`,
            personId,
            lastCentroid: centroid,
            lastSeenTimestamp: timestamp,
            velocity: {
                x: 0,
                y: 0,
                z: 0,
            },
            side: "unknown",
        };

        this.trackedHands.set(trackedHand.id, trackedHand);

        return trackedHand;
    }


    private findTrackedHand(
        personId: string,
        centroid: Point3D,
        rawHand: RawHandDetection,
        claimedHandIds: Set<string>,
    ): TrackedHand | undefined {
        let bestMatch: TrackedHand | undefined;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const trackedHand of this.trackedHands.values()) {
            if (trackedHand.personId !== personId) {
                continue;
            }

            if (claimedHandIds.has(trackedHand.id)) {
                continue;
            }

            let score = calculateDistance(
                trackedHand.lastCentroid,
                centroid,
            );

            const detectedSide =
                rawHand.handedness ?? "unknown";

            const detectedConfidence =
                rawHand.handednessConfidence ?? 0;

            if (
                trackedHand.side !== "unknown" &&
                detectedSide !== "unknown" &&
                trackedHand.side !== detectedSide
            ) {
                score += detectedConfidence * 0.25;
            }

            if (score < bestScore) {
                bestScore = score;
                bestMatch = trackedHand;
            }
        }

        return bestMatch;
    }

}

