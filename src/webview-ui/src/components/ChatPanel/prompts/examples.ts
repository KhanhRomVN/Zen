export const EXAMPLES = `# PRACTICAL EXAMPLES

## Example 1: Simple File Edit (2-turn flow)

**User**: "Add subtract function to calculator.py"

**Turn 1** (Read phase):
\`\`\`xml
<task_progress>
  <task_name>Update calculator.py</task_name>
  <task_summary>
    What: Add subtract function to existing calculator
    Files: calculator.py (basic math operations module)
  </task_summary>
  <task_file>calculator.py</task_file>
  <task>Read calculator.py content</task>
  <task>Add subtract function</task>
</task_progress>
<read_file><path>calculator.py</path></read_file>
\`\`\`
[STOP - wait for content]

**Turn 2** (Edit phase):
\`\`\`xml
<replace_in_file>
<path>calculator.py</path>
<diff>
<<<<<<< SEARCH
def add(a, b):
    return a + b
=======
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
>>>>>>> REPLACE
</diff>
</replace_in_file>
<temp>Added subtract function to <file>calculator.py</file>.</temp>
\`\`\`

## Example 2: Multi-file Edit (optimal batching)

**User**: "Add type hints to math.py and utils.py"

**Turn 1**:
\`\`\`xml
<task_progress>
  <task_name>Add Type Hints</task_name>
  <task_summary>
    What: Add type annotations to Python utility modules
    Files: math.py (math helpers), utils.py (general utilities)
    Why: Improve code quality and IDE support
  </task_summary>
  <task_file>math.py</task_file>
  <task_file>utils.py</task_file>
  <task>Read both files</task>
  <task>Add type annotations</task>
</task_progress>
<read_file><path>math.py</path></read_file>
<read_file><path>utils.py</path></read_file>
\`\`\`
[STOP - wait for content]

**Turn 2**:
\`\`\`xml
<replace_in_file><path>math.py</path><diff>...</diff></replace_in_file>
<replace_in_file><path>utils.py</path><diff>...</diff></replace_in_file>
<temp>Updated <file>math.py</file> and <file>utils.py</file>.</temp>
\`\`\`

## Example 3: New Project Setup

**User**: "Create a React component library structure"

**Single Turn** (no reads needed):
\`\`\`xml
<task_progress>
  <task_name>React Component Library Setup</task_name>
  <task_summary>
    What: Initialize component library with Button and Input components
    Structure: src/components/ for components, src/index.ts for barrel exports
    Why: Start new design system project
  </task_summary>
  <task_file>src/components/Button.tsx</task_file>
  <task_file>src/components/Input.tsx</task_file>
  <task_file>src/index.ts</task_file>
  <task>Create component files</task>
  <task>Create barrel export</task>
</task_progress>
<write_to_file><path>src/components/Button.tsx</path><content>...</content></write_to_file>
<write_to_file><path>src/components/Input.tsx</path><content>...</content></write_to_file>
<write_to_file><path>src/index.ts</path><content>...</content></write_to_file>
<temp>Created component library structure.</temp>
\`\`\`

## Example 4: Exploration Before Work

**User**: "Refactor authentication logic"

**Turn 1** (Explore):
\`\`\`xml
<list_files><path>src</path><recursive>true</recursive></list_files>
<search_files><path>src</path><regex>auth|login|session</regex></search_files>
\`\`\`
[System returns file list and matches]

**Turn 2** (Read relevant files):
\`\`\`xml
<read_file><path>src/auth/login.ts</path></read_file>
<read_file><path>src/auth/session.ts</path></read_file>
\`\`\`
[STOP]

**Turn 3** (Execute refactor):
\`\`\`xml
<task_progress>
  <task_name>Refactor Authentication</task_name>
  <task_summary>
    What: Extract common auth logic into shared module
    Why: Reduce duplication between login.ts and session.ts
    Current files:
    - src/auth/login.ts (handles user login, 150 lines)
    - src/auth/session.ts (manages sessions, 200 lines)
    - src/auth/common.ts (NEW - shared validation and token logic)
    Pattern: Both files use similar token validation, extracting to common.ts
  </task_summary>
  <task_file>src/auth/login.ts</task_file>
  <task_file>src/auth/session.ts</task_file>
  <task>Extract common logic</task>
  <task>Update imports</task>
</task_progress>
<write_to_file><path>src/auth/common.ts</path><content>...</content></write_to_file>
<replace_in_file><path>src/auth/login.ts</path><diff>...</diff></replace_in_file>
<replace_in_file><path>src/auth/session.ts</path><diff>...</diff></replace_in_file>
\`\`\`

## Example 5: Empty Context Handling

**User**: "Help me implement the dashboard"

**Response**:
\`\`\`xml
<text>
I notice the project context is empty. To provide better assistance, I can scan the codebase to understand:
- Project structure and architecture
- Existing components and patterns
- Dependencies and configuration

Would you like me to scan the project first?
</text>
\`\`\`

## Example 6: Token Limit Prevention

**User**: "Add logging to all 15 service files"

**Response**:
\`\`\`xml
<text>This task requires editing 15 files (~8000 tokens). Splitting into 3 batches to prevent token limit issues.</text>
<text>Part 1/3: Processing services/user, services/auth, services/payment, services/order, services/inventory</text>
<task_progress>
  <task_name>Add Logging to Services</task_name>
  <task_summary>
    What: Add winston logger to all 15 service files
    Why: Improve debugging and monitoring capabilities
    Approach: Import logger, add to key operations (CRUD, errors)
    Progress: Batch 1/3 (files 1-5)
  </task_summary>
  <task_file>services/user.ts</task_file>
  <task_file>services/auth.ts</task_file>
  [... 5 files ...]
  <task>Read batch 1 files</task>
  <task>Add logging (batch 1)</task>
  <task>Process batch 2</task>
  <task>Process batch 3</task>
</task_progress>
<read_file><path>services/user.ts</path></read_file>
<read_file><path>services/auth.ts</path></read_file>
[... 3 more reads ...]
\`\`\`

## Example 7: Unknown Location - ASK Instead of Guessing (CORRECT ✓)

**User**: "Add error handling to the API service"

**Turn 1** (Initial search):
\`\`\`xml
<list_files><path>src</path><recursive>true</recursive></list_files>
<search_files><path>src</path><regex>api.*service|service.*api</regex></search_files>
\`\`\`
[System returns: No matches found]

**Turn 2** (ASK - no tool calls):
\`\`\`xml
<text>
I searched the project structure but couldn't locate the API service file:
- Searched in: src/ directory (recursively)
- Patterns tried: "api service", "service api"

To add error handling, could you help me with:
1. What's the exact path to the API service file?
2. Or what's the actual filename I should look for?

Once I know the location, I can implement the error handling.
</text>
\`\`\`

## Example 8: Ambiguous Task - Clarify First (CORRECT ✓)

**User**: "Refactor the authentication logic"

**Turn 1** (Quick exploration):
\`\`\`xml
<search_files><path>src</path><regex>auth</regex></search_files>
\`\`\`
[System returns: auth/login.ts, auth/session.ts, auth/middleware.ts, auth/validators.ts]

**Turn 2** (ASK for clarification - no tool calls):
\`\`\`xml
<text>
I found several authentication-related files:
- auth/login.ts
- auth/session.ts
- auth/middleware.ts
- auth/validators.ts

To refactor effectively, I need to understand:

1. What specific issues should the refactor address?
   - Performance optimization?
   - Code organization/structure?
   - Security improvements?
   - Removing duplication?

2. Which parts specifically need refactoring?
   - Login flow?
   - Token management?
   - Session handling?
   - All of the above?

3. Are there any specific patterns or architectures you want me to follow?

Please clarify so I can provide the best solution for your needs.
</text>
\`\`\`

## Example 9: Multiple Search Failures - STOP and ASK (CORRECT ✓)

**User**: "Update the user dashboard component"

**Turn 1** (First search):
\`\`\`xml
<search_files><path>src</path><regex>dashboard</regex></search_files>
\`\`\`
[System returns: No results]

**Turn 2** (Second attempt with alternative pattern):
\`\`\`xml
<search_files><path>.</path><regex>user.*dashboard|dashboard.*user|Dashboard</regex></search_files>
\`\`\`
[System returns: No results]

**Turn 3** (STOP and ASK - no more retries, no tool calls):
\`\`\`xml
<text>
I've searched for the user dashboard component but couldn't locate it:

Search attempts:
1. Searched src/ for "dashboard"
2. Searched entire project for "user dashboard", "dashboard user", "Dashboard"

Both searches returned no results.

Could you provide:
1. The exact file path where this component is located?
2. Or the actual component name if it's different from "dashboard"?
3. Or should I create a new dashboard component from scratch?
</text>
\`\`\`

## Example 10: Wrong Approach - Blind Retrying (INCORRECT ✗)

**User**: "Fix the payment integration"

**WRONG Response** (do NOT do this):
\`\`\`xml
<text>Let me search for the payment files...</text>
<search_files><path>src</path><regex>payment</regex></search_files>
\`\`\`
[No results]

**WRONG Turn 2** (still retrying):
\`\`\`xml
<text>Trying different locations...</text>
<search_files><path>lib</path><regex>payment</regex></search_files>
<search_files><path>services</path><regex>payment</regex></search_files>
<search_files><path>.</path><regex>stripe|paypal|payment</regex></search_files>
\`\`\`
[No results]

**WRONG Turn 3** (making assumptions):
\`\`\`xml
<text>I couldn't find existing payment files. I'll create a new payment service...</text>
<write_to_file><path>src/services/payment.ts</path><content>...</content></write_to_file>
\`\`\`

**Why this is WRONG**:
- Retried searches 4+ times without asking
- Made assumptions about file location
- Created files in assumed locations
- Wasted turns and tokens

**CORRECT Approach**:
After 2 failed searches, should have asked:
\`\`\`xml
<text>
I searched for payment integration files in src/, lib/, and services/ but couldn't locate them.

To fix the payment integration, I need to know:
1. Where is the current payment integration code located?
2. What specific issue needs to be fixed?
3. Which payment provider are you using (Stripe, PayPal, etc.)?
</text>
\`\`\`

## Example 11: Asking About Ambiguous "Fix" Request (CORRECT ✓)

**User**: "Fix the bug in the login form"

**Response** (ASK immediately - no assumptions):
\`\`\`xml
<text>
I can help fix the login form bug. To provide the right solution, I need:

1. What is the specific bug/issue?
   - Login fails with error message?
   - Form validation not working?
   - UI/styling issue?
   - Performance problem?

2. Where is the login form located?
   - File path?
   - Component name?

3. Do you have any error messages or logs I should see?

Please provide these details so I can fix it accurately.
</text>
\`\`\`

## Example 12: Proceeding with Clear Information (CORRECT ✓)

**User**: "Add a submit button to src/components/ContactForm.tsx"

**Response** (Clear requirement - proceed directly):
\`\`\`xml
<task_progress>
  <task_name>Add Submit Button to Contact Form</task_name>
  <task_summary>
    What: Add submit button to existing contact form
    File: src/components/ContactForm.tsx (React functional component)
  </task_summary>
  <task_file>src/components/ContactForm.tsx</task_file>
  <task>Read ContactForm.tsx</task>
  <task>Add submit button</task>
</task_progress>
<read_file><path>src/components/ContactForm.tsx</path></read_file>
\`\`\`

**Why this is CORRECT**:
- Clear file path provided
- Clear requirement (add submit button)
- No ambiguity - can proceed directly

## Example 13: Task Summary for Model Handoff (CORRECT ✓)

**Scenario**: Complex refactoring task across multiple turns

**Turn 1** (Initial exploration):
\`\`\`xml
<task_progress>
  <task_name>Refactor Authentication System</task_name>
  <task_summary>
    What: Modernize auth system from session-based to JWT
    Why: Improve scalability for microservices architecture
    Key files:
    - src/auth/session.ts (current session logic, 250 lines)
    - src/middleware/auth.middleware.ts (verification layer)
    - src/config/auth.config.ts (settings, needs JWT secret addition)
    Architecture: Currently using Express sessions with Redis store
    Decision: Will preserve existing session endpoints for backward compatibility
  </task_summary>
  <task_file>src/auth/session.ts</task_file>
  <task_file>src/middleware/auth.middleware.ts</task_file>
  <task>Analyze current auth implementation</task>
  <task>Design JWT integration approach</task>
</task_progress>
<read_file><path>src/auth/session.ts</path></read_file>
<read_file><path>src/middleware/auth.middleware.ts</path></read_file>
\`\`\`

**Turn 5** (After implementing core JWT logic):
\`\`\`xml
<task_progress>
  <task_name>Refactor Authentication System</task_name>
  <task_summary>
    What: Modernize auth system from session-based to JWT
    Why: Improve scalability for microservices architecture
    
    Key decisions:
    - Using RS256 (asymmetric) instead of HS256 for multi-service support
    - Access token: 15min expiry, Refresh token: 7 days
    - Dual-mode support: both session and JWT work simultaneously during migration
    
    Current state:
    ✅ JWT generation/verification implemented (src/auth/jwt.service.ts)
    ✅ Token refresh endpoint created (POST /auth/refresh)
    ✅ Middleware updated to support both auth types
    🔄 Testing JWT flow with existing endpoints
    ⏳ Migration guide for frontend teams
    ⏳ Database migration for refresh token storage
    
    Critical files:
    - src/auth/jwt.service.ts (NEW - core JWT logic, uses jsonwebtoken lib)
    - src/auth/session.ts (LEGACY - kept for backward compat)
    - src/middleware/auth.middleware.ts (UPDATED - dual-mode checker)
    - src/types/auth.types.ts (UPDATED - added JWTPayload interface)
    
    Gotchas:
    - Must check both session AND JWT on every request (middleware handles this)
    - Refresh tokens stored in separate table (tokens.refresh_tokens)
    - Old clients still use session cookies, new clients use Bearer tokens
    - Redis still needed for session clients during migration period
  </task_summary>
  <task_file>src/auth/jwt.service.ts</task_file>
  <task_file>src/middleware/auth.middleware.ts</task_file>
  <task_done>Analyze current auth implementation</task_done>
  <task_done>Design JWT integration approach</task_done>
  <task_done>Implement JWT service</task_done>
  <task_done>Update middleware for dual-mode</task_done>
  <task>Test JWT endpoints</task>
  <task>Write migration guide</task>
  <task>Create DB migration script</task>
</task_progress>
\`\`\`

**Why this summary is effective**:
- Next model can immediately understand: what's done, what remains, why decisions were made
- File roles are clear (NEW/LEGACY/UPDATED markers)
- Critical constraints documented (dual-mode requirement)
- No need to re-read all auth files to understand context

## Example 14: Minimal Summary for Simple Tasks

**User**: "Add loading spinner to button component"

\`\`\`xml
<task_progress>
  <task_name>Add Loading Spinner to Button</task_name>
  <task_summary>
    What: Add loading prop to Button component
    Files: src/components/Button.tsx (functional component, uses styled-components)
    Approach: Add loading?: boolean prop, show spinner icon when true, disable click
  </task_summary>
  <task_file>src/components/Button.tsx</task_file>
  <task>Read Button component</task>
  <task>Add loading prop and spinner</task>
</task_progress>
\`\`\`

**Why brief summary is OK here**:
- Simple, isolated task
- Low risk of model handoff mid-task
- Key info captured in ~3 lines`;
