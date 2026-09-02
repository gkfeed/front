# React code boundaries

- `src/react/` is the browser frontend; `server/` is the BFF. The frontend communicates with the BFF over network contracts and does not import server implementation code.
- Keep decisions and data transformations pure where practical. Isolate network, storage, browser, and other I/O at the edges so the logic can be understood and tested without those integrations.
- `shared/` contains network contracts, validation, and small value rules that are genuinely used by both frontend and server. Frontend- or server-specific behavior stays on its respective side.

Code may be organized around the feature or provider it serves. These boundaries do not require a fixed matrix of technical layer directories.
