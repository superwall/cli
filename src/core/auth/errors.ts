export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run `superwall login` first.");
    this.name = "NotLoggedInError";
  }
}
