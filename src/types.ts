export type LandmarkSource =
    | "observed"
    | "predicted"
    | "interpolated"
    | "missing";

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface Landmark {
    position: Point3D;
    confidence: number;
    source: LandmarkSource;
    velocity?: Velocity3D;
}

export type HandSide = "left" | "right" | "unknown";

export interface Hand {
    side: HandSide;
    identityConfidence: number;
    landmarks: Landmark[];
}

export interface PendingHandSide {
    side: Hand["side"];
    count: number;
}

export interface Person {
    id: string;
    leftHand?: Hand;
    rightHand?: Hand;
}

export interface HandFlowFrame {
    people: Person[];
    timestamp: number;
}

export interface HandSideObservation {
    side: Hand["side"];
    confidence: number;
}

export interface HandFlowOptions {
    framesDelay?: number;
}


export interface RawLandmark {
    x: number;
    y: number;
    z: number;
    confidence?: number;
}

export interface RawHandDetection {
    landmarks: RawLandmark[];
    handedness?: HandSide;
    handednessConfidence?: number;
    personId?: string;
    thumbSideEvidence?: ThumbSideEvidence;
}

export interface HandFlowInput {
    timestamp: number;
    hands: RawHandDetection[];
}

export interface Velocity3D {
    x: number;
    y: number;
    z: number;
}

export interface TrackedHand {
    id: string;
    personId: string;
    lastCentroid: Point3D;
    lastSeenTimestamp: number;
    side: Hand["side"];
    velocity: Velocity3D;
}

export interface ThumbSideEvidence {
    side: HandSide;
    confidence: number;
}

export interface ThumbSideEvidence {
    side: HandSide;
    confidence: number;
}
