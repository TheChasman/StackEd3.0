// A saved Substack publication the user posts to. The registry of these is a
// rebuildable index keyed on `subdomain`; the document's
// `scaffold.remote.publication` remains the source of truth for where a post
// publishes. `nickname` is presentation-only and never written into a document.
export interface SubstackConnection {
  id: string; // crypto.randomUUID()
  subdomain: string; // normalised, e.g. "chasman1"
  nickname: string; // display label; defaults to subdomain
}
