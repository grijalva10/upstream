// Schema & types
export * from "./schema";

// Constants
export * from "./constants";

// Utils (includes createFieldUpdater for component convenience)
export * from "./utils";

// Actions (re-export for convenience, but prefer direct import for tree-shaking)
export {
  updateDealStatus,
  updateDeal,
  addNote,
  createDeal,
  generatePackage,
  getDeals,
  getDeal,
  getDealActivities,
  getSearches,
  searchProperties,
} from "./actions";
