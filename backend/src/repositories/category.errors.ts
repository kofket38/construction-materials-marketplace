export class DuplicateCategoryNameError extends Error {
  constructor() {
    super("A category with that name already exists.");
    this.name = "DuplicateCategoryNameError";
  }
}

export class CategoryInUseError extends Error {
  constructor() {
    super("The category cannot be deleted while products reference it.");
    this.name = "CategoryInUseError";
  }
}
