import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

import { env } from "../../config/env.js";

let firebaseApp: App | undefined;

export function getFirebaseApp(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existingApp = getApps().find(
    (app) => app.name === "sesaji",
  );

  if (existingApp) {
    firebaseApp = existingApp;
    return firebaseApp;
  }

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = env;

  if (
    !FIREBASE_PROJECT_ID ||
    !FIREBASE_CLIENT_EMAIL ||
    !FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Firebase Admin configuration is incomplete",
    );
  }

  firebaseApp = initializeApp(
    {
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    },
    "sesaji",
  );

  return firebaseApp;
}
