# Decisions

> Canonical decision ledger. Append-only. Agents write to `.squad/decisions/inbox/`, Scribe merges here.

---

## React Scaffold with Vite

**Author:** Verbal (⚛️ Frontend Dev)  
**Date:** 2025-07-14  
**Scope:** Frontend

### Decision
- Used **Vite 7.x** (stable) as the React build tool, declined Vite 8 beta
- Used **ESLint flat config** (`eslint.config.js`) with Prettier integration via `eslint-plugin-prettier` + `eslint-config-prettier`
- Prettier rules: single quotes, semicolons, trailing commas, 100 char print width
- Brand color `#1a5276` (deep blue) for Three Rivers Insurance — used in global styles and buttons
- Light theme only for initial scaffold (no dark mode toggle yet)

### Rationale
- Vite 7 is stable and production-ready; Vite 8 is experimental
- ESLint flat config is the modern standard going forward (ESLint 9+)
- Prettier integration via ESLint plugin catches formatting issues during lint, reducing CI friction

---

## Backend Scaffold Choices

**Author:** Fenster (🔧 Backend Dev)  
**Date:** 2026-03-02  
**Scope:** Backend

### Decision
1. **Spring Boot 3.4.1** with **Java 17** — LTS baseline, widely supported.
2. **Package structure:** `com.threeriverinsurance.{controller,service,model,repository,config}` — standard layered architecture.
3. **PostgreSQL** for production, **H2** for tests — keeps test runs fast and CI-friendly with no external DB dependency.
4. **Checkstyle** uses a custom Google-ish ruleset at `backend/checkstyle.xml`; **SpotBugs** at max effort / medium threshold.
5. **application.yml** uses Spring multi-document format (`---`) for profile separation rather than separate files.
6. **Server port** defaults to 8080; DB credentials use env vars with fallback defaults for local dev.

---

## Backend Error Handling Pattern

**Author:** Fenster (🔧 Backend Dev)  
**Date:** 2025-03-02  
**Scope:** Backend

### Decision

Implemented centralized error handling for the REST API:

- **GlobalExceptionHandler** — @RestControllerAdvice class handles all controller exceptions in one place
  - `MethodArgumentNotValidException` → 400 Bad Request with field-level error details
  - `QuoteNotFoundException` → 404 Not Found
  - Generic `Exception` → 500 Internal Server Error with safe message (no stack traces exposed)

- **ErrorResponse DTO** — Consistent error response format across all endpoints:
  ```json
  {
    "status": 400,
    "error": "Validation Failed",
    "message": "Invalid input data",
    "details": ["field: error message"],
    "timestamp": "2025-03-02T18:49:00"
  }
  ```

- **Custom exceptions** — Service layer throws domain exceptions (e.g., `QuoteNotFoundException`); controller layer stays clean and delegates to global handler

- **CORS configuration** — WebConfig implements WebMvcConfigurer to allow frontend dev server (localhost:5173) access to API endpoints

### Rationale

- **Separation of concerns** — Controllers focus on routing; exception handling is centralized
- **Consistent API responses** — All errors follow the same JSON structure, making frontend error handling predictable
- **Security** — Generic exceptions return safe messages without exposing internal details or stack traces
- **DRY principle** — No repetitive try-catch blocks in controllers; single handler manages all error scenarios
- **Spring best practices** — Leverages @RestControllerAdvice and @ExceptionHandler for clean, idiomatic error handling
- **Frontend integration** — CORS configuration enables local React dev server to call backend APIs during development

### Impact

- Controllers simplified — removed null checks and ResponseEntity.notFound() logic
- Service layer throws exceptions instead of returning null — clearer contract and easier to reason about
- Frontend can parse consistent error responses for user-friendly error messages
- SpotBugs compliance — avoided dead store warnings by not assigning unused variables

---

## Backend Core Architecture

**Author:** Fenster (🔧 Backend Dev)  
**Date:** 2025-03-02  
**Scope:** Backend

### Decision

#### Data Model & Persistence
- **JPA entities** with validation annotations (@NotNull, @NotBlank, @Email) to enforce constraints at application level
- **Snake_case column names** (customer_first_name) for database portability across PostgreSQL, MySQL, etc.
- **Separate DTOs** (QuoteRequest, QuoteResponse) from entities — keeps API contracts clean and independent of persistence
- **QuoteMapper utility** for entity-DTO conversion — simple static methods, no heavy framework overhead
- **Spring Data JPA** repositories with custom query methods (findByCustomerEmail, findByStatus, findByInsuranceType)

#### Service Layer Design
- **Two-service pattern:**
  - `QuoteCalculationService` — pure business logic for premium calculation
  - `QuoteService` — orchestrates CRUD operations, delegates to calculation service
- **Separation of concerns:** calculation logic is testable and reusable without touching persistence

#### Premium Calculation Logic
- **BigDecimal for money** — avoids floating-point precision issues, uses explicit scale (2) and rounding (HALF_UP)
- **Factor-based pricing:** base rate × coverage multiplier × type factor × (1 - deductible discount)
  - Auto base: $100/month, Home base: $150/month
  - Coverage: LIABILITY=1.0x, COMPREHENSIVE=1.5x, PREMIUM=2.0x
  - Deductibles: $500=0%, $1000=5% off, $2500=10% off, $5000=15% off
  - Auto age factor: 0-3 yrs=+20%, 4-7 yrs=+10%, 8+ yrs=0%
  - Home size: +$0.05/month per 100 sq ft over 1000 sq ft
- **Annual discount:** 5% off when paying annually (monthly × 12 × 0.95)

#### REST API Conventions
- **Resource-based URLs:** `/api/quotes`
- **HTTP semantics:** POST=201 Created, GET=200 OK, PUT=200 OK, DELETE=204 No Content
- **Validation:** @Valid on request bodies triggers automatic 400 Bad Request for constraint violations
- **Optional filters:** query params for status and insuranceType on GET /api/quotes

#### API Documentation
- **Swagger/OpenAPI:** springdoc-openapi-starter-webmvc-ui auto-generates docs at `/swagger-ui.html`
- **Annotations:** @Operation, @ApiResponses, @ApiResponse on controller methods for clear endpoint docs

#### Code Quality
- **SpotBugs exclusion:** Spring constructor injection triggers false positive EI_EXPOSE_REP2 — suppressed for controller/service packages via spotbugs-exclude.xml
- **Checkstyle + SpotBugs:** bound to verify phase, enforces Google-ish Java style and bug detection

#### Database Schema Management
- **Dev mode:** `ddl-auto: update` — Hibernate auto-creates/updates schema for rapid iteration
- **Production:** `ddl-auto: validate` — requires explicit migrations (Flyway/Liquibase future work)
- **Test mode:** `ddl-auto: create-drop` with H2 in-memory DB

### Rationale

- **DTO separation:** API contracts shouldn't change when we tweak the database schema
- **BigDecimal:** Industry standard for financial calculations — no rounding errors
- **Two-service pattern:** Calculation logic is complex enough to warrant isolation; makes testing easier
- **Swagger auto-gen:** Keeps docs in sync with code; no manual YAML editing
- **Factor-based pricing:** Transparent, auditable, easy to adjust individual factors without rewriting formulas

---

## CI Workflow Conventions

**Author:** McManus (⚙️ DevOps)  
**Date:** 2025-07-15  
**Scope:** CI/CD

### Decision
- CI workflows use **path-based triggers** scoped to `frontend/` and `backend/` directories to avoid unnecessary runs.
- Frontend CI uses **Node.js 20 LTS** with built-in npm caching via `actions/setup-node@v4`.
- Backend CI uses **Java 17 Temurin** with built-in Maven caching via `actions/setup-java@v4`.
- Backend verification runs `mvn clean verify` which includes compile, test, checkstyle, and spotbugs in a single command.
- Frontend test step is intentionally omitted until a test framework is added to `package.json`.

### Rationale
- Path-scoped triggers keep CI fast and cost-effective — no reason to build backend when only frontend changes.
- Built-in caching from official setup actions is simpler and more reliable than manual cache steps.
- `mvn clean verify` is the idiomatic Maven lifecycle for CI — it runs all quality gates in dependency order.

---

## Deployment Workflow Pattern

**Author:** McManus (⚙️ DevOps)  
**Date:** 2026-03-03  
**Scope:** CI/CD, Infrastructure

### Decision

- **Separate deploy workflows**: Created dedicated `deploy-frontend.yml` and `deploy-backend.yml` workflows that trigger on push to main with path filters.
- **Azure Static Web App**: Frontend deploys using `Azure/static-web-apps-deploy@v1` action with API token authentication.
- **Azure App Service**: Backend deploys using `azure/webapps-deploy@v3` action with service principal authentication via `azure/login@v2`.
- **Skip tests in deploy**: Deploy workflows use `-DskipTests` flag since tests already run in separate CI workflows.
- **Remote state storage**: Use Azure Storage backend for Terraform state with blob versioning and 30-day soft delete enabled.
- **Backend config**: Keep `backend.tf` out of git using `backend.tf.example` template pattern.

### Rationale

- **Path-based triggers**: Avoid deploying both services when only one changed, reducing deployment time and Azure costs.
- **Workflow separation**: Keep CI (validation) and CD (deployment) concerns separate for clearer workflow purpose and easier debugging.
- **Test efficiency**: Tests run in PR CI workflow, no need to re-run on deploy since main branch is protected.
- **State protection**: Blob versioning + soft delete prevent accidental state file corruption or deletion, critical for production infrastructure.
- **Template pattern**: `backend.tf.example` allows per-environment configuration without exposing Azure storage account names in git.

### Required Secrets

Teams adopting this pattern must configure:
- `AZURE_CREDENTIALS` — Service principal JSON with contributor access
- `AZURE_STATIC_WEB_APPS_API_TOKEN` — From Static Web App deployment settings
- `AZURE_APP_NAME` — Target App Service name
- `TF_VAR_db_admin_username` — PostgreSQL admin username
- `TF_VAR_db_admin_password` — PostgreSQL admin password

---

## LoadingSpinner Component Pattern

**Author:** Verbal (⚛️ Frontend Dev)  
**Date:** 2025-03-03  
**Scope:** Frontend / UI Components

### Decision
Created a reusable `LoadingSpinner` component at `src/components/LoadingSpinner/` with:
- Accessibility-first design (role="status", aria-live="polite")
- Customizable message prop
- Brand-aligned styling (uses #1a5276 brand color)
- Co-located CSS pattern

### Rationale
- **Reusability**: Single source of truth for loading states across the app
- **Accessibility**: Screen reader support via proper ARIA attributes
- **Consistency**: Matches brand colors and design system
- **Performance**: Lightweight, no external dependencies

### Usage Pattern
```jsx
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

// In component:
{isLoading && <LoadingSpinner message="Getting your quote..." />}
```

### Related Tasks
Part of Phase 4 Tasks 4.7 (UI Polish), 4.8 (Accessibility), 4.9 (Performance)

---

## Local Development Profile with H2

**Author:** Fenster (🔧 Backend Dev)  
**Date:** 2026-03-03  
**Scope:** Backend

### Decision

Added a `local` Spring profile that uses H2 in-memory database for local development:

- **H2 dependency scope:** Changed from `test` to `runtime` in pom.xml to make H2 available for both test and local profiles
- **Profile configuration:** Added new `local` profile section in application.yml (between default and test profiles)
  - Database: `jdbc:h2:mem:insurance_quote` (in-memory)
  - DDL mode: `create-drop` (fresh schema on each restart)
  - SQL logging: enabled (`show-sql: true`)
  - H2 console: enabled at `/h2-console` for easy data inspection
- **Default profile:** PostgreSQL configuration remains unchanged
- **Test profile:** H2 test configuration remains unchanged

### Rationale

- **Developer experience:** Removes barrier to entry for new developers who don't have PostgreSQL installed locally
- **Rapid prototyping:** H2 in-memory database provides instant startup with no setup required
- **Debugging support:** H2 console allows developers to inspect data structure and contents during development
- **Zero impact:** Existing test and production configurations are untouched; purely additive change
- **Consistency:** Uses Spring's standard multi-document YAML format for profile separation

### Usage

Developers can run the application locally without PostgreSQL:

```bash
mvn spring-boot:run -Dspring-profiles.active=local
```

Or set environment variable:
```bash
export SPRING_PROFILES_ACTIVE=local
mvn spring-boot:run
```

Access H2 console at `http://localhost:8080/h2-console` with:
- JDBC URL: `jdbc:h2:mem:insurance_quote`
- Username: (leave blank or use sa)
- Password: (leave blank)

### Impact

- New developers can start coding immediately without database setup
- Reduced friction in local development workflow
- H2 console provides visibility into schema and data during development
- Production deployment remains unchanged (uses PostgreSQL via default profile)

---

## Phase 2 Frontend — Quote Wizard Architecture

**Author:** Verbal (⚛️ Frontend Dev)  
**Date:** 2025-07-14  
**Scope:** Frontend — Quote wizard multi-step form

### Decision

Implemented a multi-step quote wizard with the following architecture:

#### Component Structure
- **QuoteWizard.jsx** — Parent container managing wizard state and navigation
- **Step components** — Separate components for each step (CustomerInfo, PropertyVehicleDetails, CoverageSelection, QuoteReview)
- **Shared CSS** — QuoteWizard.css provides shared form styling, step-specific CSS for complex components

#### State Management Pattern
- Parent component holds all form data in single state object
- `updateFormData(field, value)` callback pattern for child components to update state
- `goToStep(number)` enables jumping to specific steps from review page
- Navigation functions: `nextStep()`, `prevStep()` for wizard flow

#### Form Validation
- Client-side validation on "Next" button click in each step
- Inline error messages below each field
- Error state styling on form groups
- Validation patterns: email regex, phone regex, zip code regex, year ranges

#### Conditional Rendering
- Step 2 toggles between AUTO and HOME insurance fields based on `insuranceType`
- Radio buttons control which field set is displayed
- Validation adapts to active insurance type

#### Coverage Selection UI
- Card-based selection interface (not dropdown/radio)
- Visual feedback: hover effects, selected state, popular badge
- Features list in each card to show coverage details
- Clicking anywhere on card selects that coverage level

#### Quote Calculation
- Client-side estimate using base rate + multipliers
- Factors: vehicle/property age, size, coverage level, deductible amount
- Display both monthly and annual premiums
- Disclaimer about estimated vs final rates

#### Styling Approach
- No CSS framework — custom CSS for full control
- Professional insurance company aesthetic
- Responsive grid layouts with media queries
- Color scheme: primary blue (#1a5276), CTA green (#27ae60), neutral grays
- Card-based UI with shadows and hover states
- Stepper progress indicator with numbered circles

### Rationale

- **Single state object** — Simplifies data management across steps, easier to submit to API later
- **Callback pattern** — Clean props interface, explicit data flow
- **Inline validation** — Immediate feedback improves UX
- **Card-based coverage UI** — More engaging than dropdowns, shows value proposition
- **Client-side calculation** — Provides instant feedback, will be replaced with API call in Phase 2.9
- **No CSS framework** — Keeps bundle small, full styling control for insurance brand
- **Stepper UI** — Clear progress indication builds trust in multi-step forms

### Related Files
- `frontend/src/components/QuoteWizard/QuoteWizard.jsx`
- `frontend/src/components/QuoteWizard/QuoteWizard.css`
- `frontend/src/components/QuoteWizard/steps/CustomerInfo.jsx`
- `frontend/src/components/QuoteWizard/steps/PropertyVehicleDetails.jsx`
- `frontend/src/components/QuoteWizard/steps/CoverageSelection.jsx`
- `frontend/src/components/QuoteWizard/steps/CoverageSelection.css`
- `frontend/src/components/QuoteWizard/steps/QuoteReview.jsx`
- `frontend/src/components/QuoteWizard/steps/QuoteReview.css`

### Next Steps
- Task 2.9: Connect Step 4 "Get Quote" button to backend API
- Add loading states during API calls
- Handle API errors gracefully
- Consider adding form field persistence (localStorage) for partial completion

---

## Backend Java 21 Migration

**Author:** Fenster (🔧 Backend Dev)  
**Date:** 2026-09-30  
**Scope:** Backend, CI/CD, Infrastructure

### Decision
- Backend baseline moves from **Java 17** to **Java 21** (LTS). Supersedes the Java 17 choices in "Backend Scaffold Choices" and "CI Workflow Conventions".
- `backend/pom.xml` sets `<java.version>21</java.version>`; Spring Boot 3.4.1 parent unchanged (already supports 21).
- `ci-backend.yml` and `deploy-backend.yml` use **Java 21 Temurin** via `actions/setup-java@v4` with Maven caching.
- `infra/main.tf` App Service (`azurerm_linux_web_app.backend`) `application_stack` uses `java_server = "JAVA"`, `java_server_version = "21"`, `java_version = "21"` so the deployed runtime matches the build.

### Rationale
- Java 21 is the current LTS with longer support than 17; no application source changes required.
- Keeping build, CI, and App Service runtime on the same major version avoids bytecode/runtime mismatches.

---
