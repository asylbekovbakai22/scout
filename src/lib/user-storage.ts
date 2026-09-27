// Account-scoped browser cache; legacy unscoped data is deliberately not imported.
let activeUser: string | null = null;
let revision = 0;
export function getStorageUser() {
  return activeUser;
}
export function getStorageRevision() {
  return revision;
}
export function storageKey(key: string) {
  return activeUser ? `${key}:${activeUser}` : null;
}
export function setStorageUser(userId: string | null) {
  if (activeUser === userId) return;
  activeUser = userId;
  revision++;
  window.dispatchEvent(new Event("scout-saved-updated"));
  window.dispatchEvent(new Event("scout-profile-updated"));
}
