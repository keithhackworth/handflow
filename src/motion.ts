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

export function estimateHandLength(
    landmarks: Landmark[],
): number | undefined {
    if (landmarks.length < 2 || ! landmarks[0]) {
        return undefined;
    }

    let minX = landmarks[0].position.x;
    let maxX = landmarks[0].position.x;
    let minY = landmarks[0].position.y;
    let maxY = landmarks[0].position.y;
    let minZ = landmarks[0].position.z;
    let maxZ = landmarks[0].position.z;

    for (const landmark of landmarks) {
        const { x, y, z } = landmark.position;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);

        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    }

    return calculateDistance(
        { x: minX, y: minY, z: minZ },
        { x: maxX, y: maxY, z: maxZ },
    );
}

export function calculateHandSeparationInHandLengths(
    firstHand: Landmark[],
    secondHand: Landmark[],
): number | undefined {
    const firstCenter =
        calculateLandmarkCentroid(firstHand);

    const secondCenter =
        calculateLandmarkCentroid(secondHand);

    const firstLength =
        estimateHandLength(firstHand);

    const secondLength =
        estimateHandLength(secondHand);

    if (
        !firstCenter ||
        !secondCenter ||
        !firstLength ||
        !secondLength
    ) {
        return undefined;
    }

    const distance =
        calculateDistance(firstCenter, secondCenter);

    const averageHandLength =
        (firstLength + secondLength) / 2;

    if (averageHandLength <= 0) {
        return undefined;
    }

    return distance / averageHandLength;
}

export function calculatePointVelocity(
    previous: Point3D,
    current: Point3D,
    previousTimestamp: number,
    currentTimestamp: number,
): Velocity3D {
    const elapsedMs = currentTimestamp - previousTimestamp;

    if (elapsedMs <= 0) {
        return {
            x: 0,
            y: 0,
            z: 0,
        };
    }

    const seconds = elapsedMs / 1000;

    return {
        x: (current.x - previous.x) / seconds,
        y: (current.y - previous.y) / seconds,
        z: (current.z - previous.z) / seconds,
    };
}

export function predictPoint(
    position: Point3D,
    velocity: Velocity3D,
    elapsedMs: number,
): Point3D {
    const seconds = elapsedMs / 1000;

    return {
        x: position.x + velocity.x * seconds,
        y: position.y + velocity.y * seconds,
        z: position.z + velocity.z * seconds,
    };
}