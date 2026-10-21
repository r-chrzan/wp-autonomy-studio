import { describe, expect, it } from "vitest";
import { asFunction, asValue, createAppContainer } from "./di";

type Cradle = { greeting: string; greeter: { greet: () => string } };

describe("createAppContainer", () => {
  it("injects dependencies as one cradle object (PROXY mode)", () => {
    const container = createAppContainer<Cradle>();
    container.register({
      greeting: asValue("hello"),
      greeter: asFunction(({ greeting }: Pick<Cradle, "greeting">) => ({ greet: () => greeting })),
    });

    expect(container.cradle.greeter.greet()).toBe("hello");
  });

  it("fails fast on unknown registrations (strict mode)", () => {
    const container = createAppContainer<Cradle>();

    expect(() => container.resolve("greeting")).toThrow(/greeting/);
  });

  it("rejects singletons that depend on scoped registrations (strict mode)", () => {
    const container = createAppContainer<Cradle>();
    container.register({
      greeting: asFunction(() => "scoped").scoped(),
      greeter: asFunction(({ greeting }: Pick<Cradle, "greeting">) => ({
        greet: () => greeting,
      })).singleton(),
    });

    expect(() => container.resolve("greeter")).toThrow();
  });
});
