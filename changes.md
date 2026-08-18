Summary of Changes and Audit (partial)

Files changed in this pass
- prisma/schema.prisma
  - made `Application.applicantId` optional (String?)

- src/modules/application/application.validation.ts
  - allowed optional `applicantId` in create schema

- src/modules/application/application.controller.ts
  - implemented role-aware applicant resolution:
    - `citizen`/`business_owner`: applicantId forced to req.user.id and createdById = req.user.id
    - `field_officer`: may supply optional `applicantId` (validated to exist and be citizen/business_owner) OR leave it blank for walk-ins (applicantId = null); createdById = field officer id
    - other roles: forbidden from creating applications
  - file upload checks retained; duplicate doc-type prevention added
  - validated uploaded document types against `Service.requirements` and return missing/invalid document errors
  - ensured file cleanup on validation failures
  - call to ApplicationService.createApplication now passes optional applicantId and createdById
  - added admin handlers for listing, viewing, setting under_review, approving, and declining applications

- src/modules/application/application.service.ts
  - made `createApplication` accept optional `createdById` and used it when creating Application inside transaction
  - adjusted create data to connect applicant only when applicantId present; connect createdBy when provided, otherwise fallback to applicant
  - included applicationDocuments when fetching an application
  - listApplicationsForUser now allows `field_officer` to list applications they created

- src/modules/application/application.routes.ts
  - registered admin endpoints and protected them with `requireRole('lga_admin','super_admin')`

What I audited and found (high level)
- The current Prisma schema (source of truth) contains a relatively small set of models: `User`, `Ward`, `Service`, `ServiceFeeConfig`, `Application`, `ApplicationDocument`, `Invoice`, `Payment`, `Receipt`, `Certificate`, `Complaint`, `Notification`, `Violation`, `AuditLog`, etc.
- Many modules/controllers/services in the codebase still reference legacy models or fields that are not present in the current schema, e.g. `business`, `stateOfOriginApplication`, `permit`, `levyConfig`, `assignedCouncillorId`, and many others.
- TypeScript build failed with numerous errors: many modules assume older schema shapes (missing models, renamed fields, invalid enum members, outdated include/select shapes). Build output saved to terminal log.

Key schema inconsistencies observed (examples)
- Code references `prisma.business` — no `Business` model in current schema.
- Code references `stateOfOriginApplication` model and fields like `forwarded_to_councillor`, `approvedByCouncillorId`, etc. The current schema uses a generic `Application` model and ApplicationStatus enum with values: `draft`, `submitted`, `under_review`, `approved`, `declined`, `cancelled`.
- Code expected `Invoice` fields like `totalAmount`, `amountPaid`, `balanceDue` in different places; schema has `amount` and `paymentStatus` and different fields.
- Several controllers attempted to reference `deletedAt` on models where no such column exists in the schema.
- AuditLog.action is an enum with specific values; some code used values not present in that enum (e.g., `user_deleted`).
- File upload typing: multer types used as `multer.File` but @types/multer exports `Express.Multer.File` — some type usages are incorrect.

Decisions made
- I treated the current Prisma schema as authoritative and modified the application module to align with it (applicantId optional, createdBy support, doc validation, admin endpoints).
- I did NOT change or reintroduce missing models (e.g., Business, stateOfOriginApplication). Instead, I flagged them as schema/code mismatches to be reconciled intentionally.

Immediate next steps required (recommended)
1) Decide on the canonical model mapping:
   - If the system should continue to support domain-specific models like `Business`, `StateOfOriginApplication`, `Permit`, `LevyConfig`, then the Prisma schema must be extended with those models (careful design & migrations), OR
   - If the system moves to a unified `Application` model for all services, refactor controllers/services that reference legacy models to use the unified `Application`/`Service`/`Invoice` models.

2) I recommend choosing one of the two strategies above and applying it consistently. The former requires schema changes and data migration; the latter requires broader controller/service refactors.

3) After the strategy is chosen, we should systematically update or remove legacy controllers that reference non-existing models. This is a non-trivial refactor affecting many modules.

Build and Prisma outputs
- TypeScript build (`npm run build`) failed with ~415 errors. Key examples are in the terminal output: missing Prisma model properties, invalid enum values, invalid includes/selects, and incorrect types.
- Prisma migration to make `applicantId` optional was created and applied successfully (`20260816231148_make_applicant_optional`) and Prisma client was regenerated.

Files I changed in this pass (for quick reference)
- prisma/schema.prisma (applicantId optional)
- src/modules/application/application.validation.ts
- src/modules/application/application.controller.ts
- src/modules/application/application.service.ts
- src/modules/application/application.routes.ts

Remaining work (must be addressed to get a clean build)
- Reconcile legacy modules that refer to models not in current prisma schema (e.g., `business`, `stateOfOriginApplication`, `permit`, `levyConfig`, etc.). Each such module must either be migrated to the unified `Application` model or schema models added back in a consistent way.
- Fix many type errors that come from mismatched Prisma client types after schema changes. This will largely be resolved after addressing the legacy models or the schema expansion.
- Audit and correct audit log action strings to match `AuditAction` enum in schema.
- Fix multer type references to `Express.Multer.File` where required.
- Update seed files so `Service.requirements` contain machine-readable keys (e.g., `passport_photo`) rather than human labels.

Test plan and manual tests to perform after reconciliation
- Test citizen self-submission: applicantId=req.user.id, createdById=req.user.id
- Test business owner self-submission: same as citizen
- Test field officer submission for registered user: applicantId=existing user id, createdById=field officer id
- Test field officer walk-in submission: applicantId=null, createdById=field officer id
- Test required document validation for services with `requirements` set
- Test admin endpoints (list, view, under_review, approve, decline with reason)

Notes and rationale
- I stopped short of mass refactors because the codebase contains numerous references to legacy models; this is a design decision point (restore legacy models vs refactor code to unified models). Either path is significant and requires deliberate coordination.
- I implemented the minimal, high-priority changes requested earlier (optional applicantId, field officer proxy support, admin review endpoints) so the `Application` workflow supports walk-in applicants and field officer submissions.

Action requested from you
- Choose one of:
  A) Reintroduce legacy models into Prisma schema (e.g., `Business`, `StateOfOriginApplication`, `Permit`, `LevyConfig`), then run migrations and re-generate client. I'll then fix controllers to use the restored schema where necessary.
  B) Refactor legacy modules to use the unified `Application` model and current schema. This is a larger code effort but keeps schema compact.

Once you confirm which strategy you prefer, I will:
- Implement the full reconciliation across the codebase
- Fix TypeScript errors and run the build until clean
- Run targeted tests and return a verification report

Appendix: where to find build errors (full output)
- Full tsc output saved to: c:\Users\user\AppData\Roaming\Code\copilot-terminal-output\copilot-terminal-output-04537a00-94a3-48f3-8e6c-e7850b4ea36c.txt


