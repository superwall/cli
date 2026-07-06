import type { AgentDriver, DriverInfo } from "./types";
import { claudeDriver } from "./claude";
import { codexDriver } from "./codex";

export * from "./types";
export { claudeDriver, codexDriver };

/** All drivers, in default preference order. */
export const ALL_DRIVERS: AgentDriver[] = [claudeDriver, codexDriver];

export interface DetectedDriver {
  driver: AgentDriver;
  info: DriverInfo;
}

/** Detect every installed agent CLI, preserving preference order. */
export async function detectDrivers(): Promise<DetectedDriver[]> {
  const results = await Promise.all(
    ALL_DRIVERS.map(async (driver) => {
      const info = await driver.detect();
      return info ? { driver, info } : null;
    }),
  );
  return results.filter((r): r is DetectedDriver => r !== null);
}
