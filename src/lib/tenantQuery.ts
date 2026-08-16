import { collection, query, where, CollectionReference, Query, DocumentData } from 'firebase/firestore';
import { db } from './firebase';

// Shared helpers so every service function scopes its Firestore reads to the
// caller's own school explicitly (schoolId is always passed in by the caller —
// never read from a module-level/global singleton — so a super-admin screen
// could one day query a specific school without this helper leaking state
// across unrelated screens).

export function tenantCollection(name: string, schoolId: string) {
  return query(collection(db, name), where('schoolId', '==', schoolId));
}

export function withSchool<T extends Query<DocumentData> | CollectionReference<DocumentData>>(
  q: T,
  schoolId: string
) {
  return query(q, where('schoolId', '==', schoolId));
}
