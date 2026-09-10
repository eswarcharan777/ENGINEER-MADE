# Firebase security setup

The repository includes deny-by-default production Firestore rules in `firestore.rules`.

## Security model

- A learner can read and update only `users/{theirUid}`.
- A learner document accepts only the profile/progress fields used by the app.
- A learner cannot create an `admin`, `role`, or other privilege field.
- Public catalog data is readable by visitors, but only an authenticated user whose Firebase ID token contains `admin: true` may modify it.
- A signed-in learner can create a report owned by their UID. Only an administrator can list, resolve, or delete reports.
- Audit logs, telemetry, and upload metadata are server-only; browser clients cannot read or write them.
- All unrecognized collections are denied.

Admin access is based exclusively on a Firebase Authentication custom claim. Do not use a Firestore field such as `users/{uid}.role` as proof of administrator access.

## Select the Firebase project

Install the Firebase CLI if it is not already installed, authenticate, then select the existing project:

```powershell
firebase login
firebase use --add
```

Alternatively, copy `.firebaserc.example` to `.firebaserc`, replace the placeholder, and keep `.firebaserc` uncommitted if different developers use different projects.

## Grant the first administrator

Custom claims must be set from a trusted environment with the Firebase Admin SDK, never from React. Run an audited one-time admin script or a protected backend operation equivalent to:

```js
await getAuth().setCustomUserClaims(uid, { admin: true });
```

The user must sign out and sign back in (or force-refresh their ID token) before the new claim appears. Keep the service-account credential outside Git and Vercel source files.

## Test locally with the emulator

Start the emulators from the repository root:

```powershell
firebase emulators:start --only auth,firestore
```

At minimum, verify these cases in the Emulator UI or with `@firebase/rules-unit-testing`:

1. Unauthenticated writes are rejected.
2. Learner A can read/update `users/A` but cannot access `users/B`.
3. A learner cannot add `admin` or `role` to their document.
4. A learner can update `completedLessons` and their valid profile.
5. A learner cannot write learning paths, modules, lessons, jobs, or announcements.
6. A token with `admin: true` can manage catalog content and reports.
7. A learner can create an open report for their own UID, but cannot resolve it.
8. A learner cannot access `auditLogs`, `telemetryEvents`, or `uploads`.

No rules-unit-test dependency was added automatically because this project does not currently include a Firebase test harness. This avoids adding an unverified network dependency immediately before release.

## Deploy only the Firestore configuration

After emulator verification:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

Deploying rules changes live database permissions immediately. Confirm the selected project ID before running the command.

## Collection contract

The persistence layer should use these collections:

- `users/{uid}` for learner profile and `completedLessons`
- `learningPaths/{pathId}/modules/{moduleId}/lessons/{lessonId}` for the hierarchical catalog
- `jobs/{jobId}`
- `announcements/{announcementId}`
- `reports/{reportId}` with `createdBy`, `createdAt`, and initial `status: "open"`
- `auditLogs/{logId}` for server-authored administrator actions
- `telemetryEvents/{eventId}` for privacy-minimised reliability signals
- `uploads/{uploadId}` for administrator asset metadata; binary files remain in Firebase Storage

## Administrator uploads

The API accepts JPG, PNG, WebP, GIF, PDF, and DOCX files up to 10 MB through
`POST /api/admin/uploads`. Add `FIREBASE_STORAGE_BUCKET` and a service-account
credential to the backend/Vercel environment. Storage rules deliberately deny
all browser access: upload and later asset-delivery policy stay under trusted
backend control.

Top-level `modules` and `lessons` are also secured for compatibility during migration. Prefer the hierarchical catalog for the final implementation.
