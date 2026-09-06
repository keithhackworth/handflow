export interface HandFlowConfig {
    handSideEvidenceWindow: number;
    framesDelay: number;
    historySize: number;
    handednessMatchAmbiguityDistanceInHandLengths: number;
}

export const DEFAULT_HAND_FLOW_CONFIG: HandFlowConfig = {
    handSideEvidenceWindow: 3,
    framesDelay: 0,
    historySize: 3,
    handednessMatchAmbiguityDistanceInHandLengths: 0.25,
};