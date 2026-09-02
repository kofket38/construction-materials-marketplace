export class ProjectReorderOwnershipError extends Error {
  constructor() {
    super(
      "The reorder list must exactly match the projects owned by this user.",
    );
    this.name = "ProjectReorderOwnershipError";
  }
}

/**
 * Raised when a project cannot be deleted because RFQs or orders still
 * reference it. The procurement foreign keys are ON DELETE RESTRICT so a
 * purchase record can never lose the project it was raised for; the owner
 * detaches or settles the procurement first.
 */
export class ProjectHasProcurementError extends Error {
  constructor() {
    super("The project still has linked requests for quote or orders.");
    this.name = "ProjectHasProcurementError";
  }
}
