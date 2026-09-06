// src/motion.ts
import type { Landmark, Velocity3D, Point3D } from "./types.js";

export function calculateLandmarkCentroid(
    landmarks: Landmark[],
): Point3D | undefined {
    if (landmarks.length === 0) {
        return undefined;
    }

    let x = 0;
    let y = 0;
    let z = 0;

    for (const landmark of landmarks) {
        x += landmark.position.x;
        y += landmark.position.y;
        z += landmark.position.z;
    }

    return {
        x: x / landmarks.length,
        y: y / landmarks.length,
        z: z / landmarks.length,
    };
}

export function calculateDistance(
    a: Point3D,
    b: Point3D,
): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

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
