import { jsonStringifyLargeObject } from "../../../src/lib/json";

describe("jsonStringifyLargeObject", () => {
  it("works normally with a small object", () => {
    const smallObject = {
      name: "Mozart",
      isGoodBoy: true
    };
    const s = jsonStringifyLargeObject(smallObject);
    expect(s).toEqual('{\n  "name": "Mozart",\n  "isGoodBoy": true\n}');
  });

  it("returns empty string on fallback failure", () => {
    const largeObject = {
      name: "Brian",
      isGoodBoy: true,
      type: "big"
    };
    jest.spyOn(JSON, "stringify").mockImplementation(() => {
      throw new Error("fake error to simulate an `Invalid string length`");
    });

    const s = jsonStringifyLargeObject(largeObject);
    expect(s).toEqual("");
  });
});
