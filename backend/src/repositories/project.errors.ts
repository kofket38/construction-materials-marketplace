export class ProjectReorderOwnershipError extends Error {
  constructor() {
    super(
      "The reorder list must exactly match the projects owned by this user.",
    );
    this.name = "ProjectReorderOwnershipError";
  }
}
