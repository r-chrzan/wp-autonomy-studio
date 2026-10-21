import { createContainer, InjectionMode, type AwilixContainer } from "awilix";

export {
  asClass,
  asFunction,
  asValue,
  type AwilixContainer,
  type Resolver,
} from "awilix";

/**
 * Creates an Awilix container with the project defaults.
 *
 * - `PROXY` injection mode: dependencies arrive as one cradle object
 *   (`constructor({ orm, logger })`). `CLASSIC` mode parses parameter names,
 *   which breaks once the bundler minifies them.
 * - `strict`: fails on unknown registrations and on singletons that depend
 *   on scoped registrations.
 *
 * `Cradle` describes every registration so `container.cradle` is typed.
 */
export function createAppContainer<Cradle extends object>(): AwilixContainer<Cradle> {
  return createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });
}
