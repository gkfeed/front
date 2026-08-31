# React architecture

The frontend uses inward-facing domain and feature contracts with React adapters at the UI edge.

- `domain/` contains pure feed and preview rules. It must not depend on React, state, services, or UI modules.
- `presentation/` maps domain outcomes to framework-agnostic display values such as localization keys.
- `features/` contains application rules and port types. It must not import concrete services or the composition root.
- `services/` implements HTTP, storage, and third-party integration details.
- `platform/` contains browser capabilities shared by UI mechanisms, such as fullscreen and abort timeouts.
- `application/` is the composition root that binds feature contracts to services.
- `state/` provides application-wide React contexts. `FeatureUseCasesProvider` owns the composed use cases; `AuthProvider` owns only the authentication session.
- `hooks/` contains reusable React mechanisms. Feature workflows use contracts through `useFeatureUseCases`; hooks at an integration edge may use `platform/` or a focused third-party service.
- `adapters/` coordinates hooks, routing, state, and localized errors into page models.
- `pages/` renders page models and components. Production pages may depend on `adapters/` and `components/`, but not directly on domain, feature, hook, service, or state modules.
- `components/` contains reusable UI. Provider-specific feed card rendering lives under `components/providers/`.

Lazy route entry points in `src/App.tsx` live under `pages/`; route-specific coordination belongs in an adapter rather than a reusable component.

The application root always supplies composed use cases through `AppProviders`. `useFeatureUseCases`
creates a lazy standalone composition only for isolated component and hook rendering.

`server/architecture.test.ts` enforces the dependency rules that are important enough to prevent accidental erosion.
