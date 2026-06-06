// Generate a v4 UUID. Prefers the native crypto.randomUUID, but falls back to a
// Math.random-based implementation because crypto.randomUUID only exists in
// secure contexts (HTTPS/localhost) and modern browsers — on plain http:// or
// older browsers it's undefined and throws, which previously failed group
// registrations (the only path that needs a group id).
export const safeUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
