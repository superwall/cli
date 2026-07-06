import type { Arguments } from "yargs";
import { SuperwallApi } from "@/core/api/client";
import { CONFIG_FILE, plan as planLocal, pull, push, readLocal, writeLocal } from "@/core/local";
import { ui } from "@/ui";
import { defineCommand } from "@/command";

/** `superwall <init|pull|plan|push>` — local-first Monetization-as-Code. */
export function runLocal(command: "init" | "pull" | "plan" | "push"): (argv: Arguments) => Promise<void> {
  return defineCommand(async (ctx) => {
    const { installDir: dir, dryRun } = ctx;
    const api = SuperwallApi.fromSession(); // throws NotLoggedInError → handled centrally

    if (command === "init" || command === "pull") {
      const state = await withSpinner("Pulling from Superwall", () => pull(api));
      writeLocal(dir, state);
      ui.success(
        `Wrote \`${CONFIG_FILE}\` · ${state.entitlements.length} entitlements, ${state.products.length} products`,
      );
      return;
    }

    const local = readLocal(dir);
    const p = await withSpinner("Planning", () => planLocal(api, local));
    const nothing = p.entitlements.length === 0 && p.products.length === 0;

    if (command === "plan" || dryRun) {
      if (nothing) return void ui.success("Up to date — nothing to create.");
      ui.step(`${command === "push" ? "Would create" : "Plan"}:`);
      for (const id of p.entitlements) ui.info(`+ entitlement \`${id}\``);
      for (const id of p.products) ui.info(`+ product \`${id}\``);
      return;
    }

    // push
    if (nothing) return void ui.success("Up to date — nothing to create.");
    const done = await withSpinner("Pushing to Superwall", () => push(api, local));
    ui.success(`Pushed · created ${done.entitlements.length} entitlements, ${done.products.length} products`);
    for (const id of done.entitlements) ui.info(`+ entitlement ${id}`);
    for (const id of done.products) ui.info(`+ product ${id}`);
  });
}

async function withSpinner<T>(label: string, work: () => Promise<T>): Promise<T> {
  const spin = ui.spinner();
  spin.start(label);
  try {
    const result = await work();
    spin.stop(label);
    return result;
  } catch (e) {
    spin.stop("Failed");
    throw e;
  }
}
