import type { ActionId, WizardAction } from "./types";
import { integrateAction } from "./integrate";
import { placementsReviewAction } from "./placements-review";
import { placementsImplementAction } from "./placements-implement";
import { dashboardSetupAction } from "./dashboard-setup";
import { migrateAction } from "./migrate";

export * from "./types";

export const ACTIONS: WizardAction[] = [
  integrateAction,
  placementsReviewAction,
  placementsImplementAction,
  dashboardSetupAction,
  migrateAction,
];

export const actionById: Record<ActionId, WizardAction> = {
  integrate: integrateAction,
  "placements-review": placementsReviewAction,
  "placements-implement": placementsImplementAction,
  "dashboard-setup": dashboardSetupAction,
  migrate: migrateAction,
};
