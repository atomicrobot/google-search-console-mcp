import { Firestore } from "@google-cloud/firestore";

let _client: Firestore | null = null;

export function getFirestore(databaseId: string): Firestore {
  if (!_client) {
    _client = new Firestore({ databaseId });
  }
  return _client;
}

/** Reset singleton for testing. */
export function _resetClient(): void {
  _client = null;
}
