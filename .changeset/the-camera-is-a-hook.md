---
"@graview/react": patch
---

Where the camera goes on its own — to a drive-in off the edge of a large city, and down into the village a descent left — is `useCameraFlights` in `scene-camera.ts`, handed the layout and the camera's setter; the scene keeps the camera's state, because the pan and the layout read it. `Scene` is a thousand lines rather than fourteen hundred.
