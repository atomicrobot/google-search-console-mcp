import { getFirestore } from "@lib/firestore-client";

const COLLECTION = "refreshTokens";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface RefreshTokenData {
  email: string;
  domain: string;
}

export async function saveRefreshToken(
  databaseId: string,
  token: string,
  data: RefreshTokenData,
): Promise<void> {
  const db = getFirestore(databaseId);
  await db
    .collection(COLLECTION)
    .doc(token)
    .set({
      email: data.email,
      domain: data.domain,
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    });
}

export async function consumeRefreshToken(
  databaseId: string,
  token: string,
): Promise<RefreshTokenData | null> {
  const db = getFirestore(databaseId);
  const docRef = db.collection(COLLECTION).doc(token);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as RefreshTokenData & { expiresAt: { toDate(): Date } };
    tx.delete(docRef);

    if (data.expiresAt.toDate() < new Date()) {
      return null;
    }

    return { email: data.email, domain: data.domain };
  });
}
