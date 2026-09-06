// src/motion.ts
import type { Landmark, Velocity3D } from "./types.js";

export function calculateVelocity(
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
