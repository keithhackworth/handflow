import { describe, expect, it } from "vitest";
import { HandFlow } from "../src/HandFlow.js";

describe("HandFlow", () => {
    it("returns the input for the initial pass-through implementation", () => {
        const flow = new HandFlow();

        const input = {
            hands: [],
        };
        const expectedOutput = {
            people: [],
        };

        expect(flow.process(input)).toStrictEqual(expectedOutput);
    });
});