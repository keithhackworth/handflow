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
}

export type HandSide = "left" | "right" | "unknown";

export interface Hand {
    side: HandSide;
    identityConfidence: number;
    landmarks: Landmark[];
}

export interface Person {
    id: string;
    leftHand?: Hand;
    rightHand?: Hand;
}

export interface HandFlowResult {
    people: Person[];
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
}

export interface HandFlowInput {
    hands: RawHandDetection[];
}
