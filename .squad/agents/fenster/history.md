# Fenster — History

## Project Context
- **Project:** Three Rivers Insurance — Insurance Quote Website
- **Frontend:** ReactJS
- **Backend:** Java
- **Infrastructure:** Azure with Terraform
- **CI/CD:** GitHub Actions
- **User:** Jorge Balderas

## Learnings
- Backend lives at `backend/` with Spring Boot 3.4.1, Java 21 (migrated from 17), Maven build
- Package root: `com.threeriverinsurance` with sub-packages: controller, service, model, repository, config
- Health endpoint: `GET /api/health` → `{"status":"UP"}`
- Test profile uses H2 in-memory DB; production targets PostgreSQL
- Checkstyle config at `backend/checkstyle.xml` (custom Google-ish rules); run `mvn checkstyle:check`
- SpotBugs configured in pom.xml; run `mvn spotbugs:check`
- Build + test: `mvn clean verify` from `backend/`
- `application.yml` uses Spring multi-document format for profile-specific config (test profile section separated by `---`)
- Checkstyle `FileTabCharacter` must be a module, not a property on `Checker`
- **Never use hardcoded default credentials in `application.yml`** — use `${ENV_VAR}` without defaults for `DB_PASSWORD` and `DB_USERNAME`. GitGuardian flags default credentials as leaked secrets, blocking CI.
- **Data model pattern:** JPA entities live in `model/` with validation annotations (@NotNull, @NotBlank, @Email); use proper column names with snake_case (customer_first_name) for DB portability
- **DTO pattern:** Separate request/response DTOs from entities; use a QuoteMapper utility class for clean entity-DTO conversion
- **Service layering:** QuoteCalculationService handles business logic (premium calculation), QuoteService handles CRUD with repository — keeps concerns separated
- **Premium calculation:** Use BigDecimal for monetary values with explicit scale and rounding; factor-based approach (base rate × coverage multiplier × type factor × deductible discount) for transparent pricing
- **REST conventions:** POST /api/quotes returns 201 Created; validation failures return 400; missing resources return 404; use @Valid for automatic DTO validation
- **Swagger integration:** springdoc-openapi-starter-webmvc-ui (v2.7.0) auto-generates OpenAPI docs at /swagger-ui.html; use @Operation and @ApiResponse annotations for endpoint documentation
- **SpotBugs false positives:** Spring constructor injection triggers EI_EXPOSE_REP2; suppress with spotbugs-exclude.xml filter for controller/service packages
- **Hibernate ddl-auto:** Use `update` for dev (auto-creates schema), `validate` for prod (requires migrations), `create-drop` for tests
- **Build plugin binding:** Checkstyle and SpotBugs must have `<executions>` sections with `<phase>verify</phase>` to run during `mvn verify`
- **Global exception handling:** Use @RestControllerAdvice for centralized error handling; return ErrorResponse DTO with consistent structure (status, error, message, details, timestamp)
- **Custom exceptions:** Throw custom exceptions (e.g., QuoteNotFoundException) from service layer; let GlobalExceptionHandler convert to appropriate HTTP responses
- **CORS configuration:** Use WebMvcConfigurer.addCorsMappings() to configure CORS for API endpoints; set allowedOrigins, allowedMethods, allowedHeaders, and allowCredentials
- **SpotBugs dead store:** Avoid assigning variables that are never read; in updateQuote, call findById().orElseThrow() directly without storing the result
- **Test data factory pattern:** Use builder pattern for test data creation (TestDataFactory with fluent withX() methods) for flexible, readable test setup
- **Deductible discount logic:** $1000 deductible gets 5% discount (>= 1000 condition in QuoteCalculationService); test assertions must account for this
- **Integration test profile:** Use @ActiveProfiles("test") on @SpringBootTest integration tests to use H2 in-memory DB instead of PostgreSQL
- **Premium calculation verification:** Monthly premium = base × coverage × (1 - deductible discount) × type factor; annual = monthly × 12 × 0.95 (5% annual discount)
- **Spring Security REST API pattern:** Use SecurityFilterChain bean with CSRF disabled for stateless REST APIs; configure security headers (X-Frame-Options, CSP, HSTS) via headers() DSL; permit all API endpoints when no authentication is required
- **Security test patterns:** @WebMvcTest with @AutoConfigureMockMvc(addFilters = false) for controller unit tests to bypass security; @SpringBootTest with @AutoConfigureMockMvc for integration tests loads full security context automatically
- **Security headers verification:** Test security headers (X-Frame-Options, Content-Security-Policy) on response; HSTS only applies to HTTPS requests (not in test mode with HTTP)
- **Spring Security dependencies:** spring-boot-starter-security for runtime, spring-security-test for test support; both required for MockMvc security testing with @WithMockUser and .with(csrf())
- **Local profile pattern:** Added `local` Spring profile with H2 in-memory database for local development; developers can run app with `-Dspring.profiles.active=local` to avoid needing PostgreSQL locally. H2 dependency scope changed to `runtime` (was `test`) to support both test and local profiles. Local profile enables H2 console at `/h2-console`, uses `create-drop` ddl-auto for fresh schema on restart, and shows SQL for debugging.
- **H2/local is now the DEFAULT profile:** `application.yml` sets `SPRING_PROFILES_ACTIVE:local` so running `mvn spring-boot:run` with no flags uses H2. Production/staging must explicitly set `SPRING_PROFILES_ACTIVE=default` for PostgreSQL.


