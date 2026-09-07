import { describe, expect, it } from "vitest";
import type {
    Landmark
} from "../src/types.js";
import {
    calculateVelocity,
    estimateHandLength,
    predictPoint,
    calculatePointVelocity,
} from "../src/motion.js";

describe("calculateVelocity", () => {
    it("returns zero velocity when timestamps are equal", () => {
        const previous = {
            position: { x: 0, y: 0, z: 0 },
            confidence: 1,
            source: "observed" as const,
        };

        const current = {
            position: { x: 1, y: 1, z: 1 },
            confidence: 1,
            source: "observed" as const,
        };

        expect(calculateVelocity(previous, current, 100, 100))
            .toStrictEqual({ x: 0, y: 0, z: 0 });
    });

    it("returns zero velocity when timestamps go backwards", () => {
        const previous = {
            position: { x: 0, y: 0, z: 0 },
            confidence: 1,
            source: "observed" as const,
        };

        const current = {
            position: { x: 1, y: 1, z: 1 },
            confidence: 1,
            source: "observed" as const,
        };

        expect(calculateVelocity(previous, current, 200, 100))
            .toStrictEqual({ x: 0, y: 0, z: 0 });
    });
});

it("estimates hand length from landmark bounds", () => {
    const landmarks: Landmark[] = [
        {
            position: { x: 0, y: 0, z: 0 },
            confidence: 1,
            source: "observed",
        },
        {
            position: { x: 3, y: 4, z: 0 },
            confidence: 1,
            source: "observed",
        },
    ];

    expect(estimateHandLength(landmarks)).toBeCloseTo(5);
});

it("cannot estimate hand length from fewer than two landmarks", () => {
    expect(estimateHandLength([])).toBeUndefined();

    expect(
        estimateHandLength([
            {
                position: { x: 1, y: 1, z: 1 },
                confidence: 1,
                source: "observed",
            },
        ]),
    ).toBeUndefined();
});

it("calculates point velocity", () => {
    expect(
        calculatePointVelocity(
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 2, z: 0 },
            1000,
            2000,
        ),
    ).toEqual({
        x: 1,
        y: 2,
        z: 0,
    });
});

it("predicts a point from velocity", () => {
    expect(
        predictPoint(
            { x: 1, y: 1, z: 0 },
            { x: 2, y: -1, z: 0 },
            500,
        ),
    ).toEqual({
        x: 2,
        y: 0.5,
        z: 0,
    });
});
