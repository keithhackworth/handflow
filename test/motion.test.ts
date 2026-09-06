import { describe, expect, it } from "vitest";
import { calculateVelocity } from "../src/motion.js";

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