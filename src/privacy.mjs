export function containsCredential(message) {
  return /\b(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*\S+|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{16,}/i.test(message);
}
