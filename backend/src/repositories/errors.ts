export class DuplicateEmailError extends Error {
  constructor() {
    super("A user with that email already exists.");
    this.name = "DuplicateEmailError";
  }
}
