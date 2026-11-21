// An error whose message is safe and useful to show to the person who caused
// it ("Only the host can do that."). Anything else that gets thrown is a bug,
// so we log it and show a generic message instead of leaking internals.
export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}
