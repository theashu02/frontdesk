"use server";

import { cert, getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let appInitialized = false;

function getFirebaseConfig(): AppOptions["credential"] {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return cert({
    projectId,
    clientEmail,
    privateKey,
  });
}

function ensureApp() {
  if (appInitialized) {
    return;
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: getFirebaseConfig(),
    });
  }

  appInitialized = true;
}

export async function getDb() {
  ensureApp();
  return getFirestore();
}
