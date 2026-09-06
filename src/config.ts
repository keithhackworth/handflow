export interface HandFlowConfig {
    handSideEvidenceWindow: number;
    framesDelay: number;
    historySize: number;
}

export const DEFAULT_HAND_FLOW_CONFIG: HandFlowConfig = {
    handSideEvidenceWindow: 3,
    framesDelay: 0,
    historySize: 3,
};