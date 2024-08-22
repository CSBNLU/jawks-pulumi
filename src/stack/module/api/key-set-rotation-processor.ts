export interface KeySetRotationProcessor {
  execute: () => Promise<void>;
}
