/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { createCollisionApi } from './collision-worker-api';

// Entry point for the shared collision worker. The engine is framework-free (no Angular runtime
// enters this bundle); Comlink handles the request/response wiring over postMessage. The triple-
// slash reference supplies the worker globals (`self`, `postMessage`) without adding "webworker"
// to the shared tsconfig `lib`, which would leak worker types into DOM code.
Comlink.expose(createCollisionApi());
