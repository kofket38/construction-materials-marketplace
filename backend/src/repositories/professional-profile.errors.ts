export class DuplicateSpecialtyError extends Error {
  constructor() {
    super("This specialty already exists on the profile.");
    this.name = "DuplicateSpecialtyError";
  }
}

export class DuplicateProfessionalProfileError extends Error {
  constructor() {
    super("A professional profile already exists for this user.");
    this.name = "DuplicateProfessionalProfileError";
  }
}
