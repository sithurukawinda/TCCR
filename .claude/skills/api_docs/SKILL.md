---
name: api_docs
description: 'Generates markdown API documentation from FastAPI routes, Pydantic models, DRF viewsets, and serializers — also detects drift between code and existing docs. Use when asked to "generate api docs", "document api", "api documentation", "openapi", "swagger docs", "update api docs", "check api drift", or "document endpoints".'
---

# API Documentation Generator

Generates comprehensive markdown API documentation by scanning FastAPI routes, Pydantic models, DRF viewsets, and serializers. Also detects drift between existing documentation and current code.

## When to Use

- You need to generate API documentation from a FastAPI or Django REST Framework project
- You want to check if existing API docs are still accurate after code changes
- You need to document request/response schemas from Pydantic models or DRF serializers
- You want a quick overview of all endpoints in your project

## Prerequisites

- A FastAPI or Django REST Framework project
- Route/view definitions accessible in the codebase

## Workflow

### `/api-docs generate` — Generate API documentation

1. **Detect API framework**:
   ```bash
   # FastAPI detection
   grep -r "APIRouter\|FastAPI()" --include="*.py" .

   # Django REST Framework detection
   grep -r "ViewSet\|APIView\|@api_view" --include="*.py" .
   ```

2. **For FastAPI projects**:
   - Find all router files and route definitions
   - Extract: HTTP method, path, request/response Pydantic models, docstrings, dependencies
   - Parse Pydantic models for field types, descriptions, defaults, validation:
     ```bash
     grep -r "class.*BaseModel" --include="*.py" -l .
     ```

3. **For DRF projects**:
   - Find all viewsets, views, and URL configurations
   - Extract: actions (list, create, retrieve, update, destroy, custom), serializers, permissions
   - Parse serializers for field types, required/optional, validation:
     ```bash
     grep -r "class.*Serializer" --include="*.py" -l .
     ```

4. **Generate markdown documentation**:
   ```markdown
   # API Documentation

   ## Authentication
   {Detected auth mechanism}

   ## Endpoints

   ### {Group/Router Name}

   #### `{METHOD} {path}`
   {Description from docstring}

   **Request Body:**
   | Field | Type | Required | Description |
   |-------|------|----------|-------------|

   **Response:**
   | Field | Type | Description |
   |-------|------|-------------|

   **Status Codes:**
   | Code | Description |
   |------|-------------|
   ```

5. **Write** to `docs/api.md` or user-specified location.
6. **Offer to add** a table of contents with links to each endpoint group.

### `/api-docs diff` — Detect documentation drift

1. **Read existing API documentation file** (`docs/api.md` or user-specified location).
2. **Scan current code** for all endpoints (same detection as generate).
3. **Compare** documented endpoints vs actual endpoints:
   - New endpoints not in docs
   - Removed endpoints still in docs
   - Changed request/response schemas
   - Changed paths or methods
4. **Present a drift report** with specific discrepancies:
   ```
   API Documentation Drift Report
   ==============================

   Added (not documented):
   - POST /api/v1/users/bulk-invite

   Removed (still documented):
   - DELETE /api/v1/users/{id}/avatar

   Changed:
   - PUT /api/v1/users/{id}
     - Added field: `phone_number` (string, optional)
     - Removed field: `legacy_id`
   ```
5. **Offer to update** the documentation with the detected changes.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Framework not detected | No FastAPI or DRF imports found | Verify the project uses a supported framework; check for non-standard import patterns |
| Routes spread across many files | Large project with modular routing | The tool scans recursively; ensure all route files use standard decorators and patterns |
| Dynamic route generation | Routes created programmatically at runtime | Document dynamic routes manually or point the tool to the route registration code |
| Pydantic v1 vs v2 differences | Model syntax varies between versions | The tool handles both `BaseModel` styles; flag any issues for manual review |
| Existing docs in non-standard format | Docs don't follow expected markdown structure | Use `generate` to create fresh docs, then manually merge custom sections |
