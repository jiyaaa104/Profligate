# Profligate

**An AI-assisted personal finance companion that helps students
understand, control, and improve their spending habits.**

**Tagline:** Spend consciously. Save intentionally.

> **Product principle:** Profligate should not merely record what a user
> has spent. It should help the user recognise spending patterns, make
> informed purchase decisions, and build healthier financial habits.

---

## 1. Project Overview

### 1.1 Problem Statement

Students often receive a fixed monthly allowance, scholarship, stipend,
or part-time income. Small, frequent, and impulsive purchases can
accumulate quickly. Many students realise how much they have spent only
after their available money has become low.

Traditional expense trackers primarily report past transactions.
Profligate aims to help users understand their spending and intervene
before avoidable purchases create problems.

### 1.2 Proposed Solution

Profligate is a responsive MERN web application, designed to be
mobile-friendly and progressively enhanced into an installable
Progressive Web App (PWA).

It enables users to:

- Record income and expenses.
- Categorise and review transactions.
- Set monthly and category-wise budgets.
- Monitor available balance and budget utilisation.
- Receive rule-based alerts when spending approaches or exceeds
  limits.
- Evaluate a planned purchase before spending.
- Receive AI-generated spending insights and personalised
  recommendations.
- Ask questions about their own financial data through an optional AI
  assistant.

### 1.3 Target Audience

**Primary audience** - College and university students. - Students
living in hostels or rented accommodation. - Students receiving monthly
allowances. - Students with internships, stipends, or part-time income.

**Secondary audience** - Young professionals. - People beginning to
manage their own finances.

### 1.4 Project Goals

1.  Make expense tracking simple and convenient.
2.  Help users understand where their money goes.
3.  Detect potential overspending early.
4.  Encourage users to think before making non-essential purchases.
5.  Provide useful, explainable financial insights.
6.  Demonstrate sound full-stack engineering, testing, security, and
    responsible AI integration.

---

## 2. Product Scope and Release Plan

The project will be developed in small, testable releases. A complete
and reliable MVP takes priority over a large set of unfinished features.

### 2.1 MVP --- Version 1

The MVP must include:

1.  User registration, login, and logout.
2.  User profile and financial preferences.
3.  Manual income and expense entry.
4.  Transaction listing, editing, deletion, search, and filters.
5.  Opening balance setup.
6.  Dashboard with income, expenditure, available balance, and recent
    transactions.
7.  Monthly and category-wise budgets.
8.  Rule-based spending alerts.
9.  Purchase Check.
10. Responsive desktop and mobile interface.
11. Automated tests for financial calculations, authentication, and user
    data ownership.

**MVP data-entry decision:** Transactions will be entered manually. CSV
import, receipt scanning, and banking integrations are not required for
Version 1.

### 2.2 Version 1.1 --- AI Intelligence

After the MVP is stable and deployed:

- AI-generated weekly or monthly spending insights.
- Personalised saving recommendations.
- Explanations for rule-based alerts.
- Structured AI outputs with validation.
- User feedback on recommendations.

### 2.3 Version 2 --- Optional Expansion

- AI financial chatbot with controlled backend tools.
- Savings goals and contribution history.
- Upcoming planned-expense management.
- Subscription and recurring-payment tracker.
- CSV import and export.
- Browser push notifications.
- Advanced spending-pattern analysis.
- PWA installation and offline-friendly read-only views.
- More advanced analytics and forecasting.

### 2.4 Out of Scope

The initial project will not:

- Connect directly to bank accounts.
- Store bank passwords, UPI PINs, card PINs, or banking credentials.
- Initiate payments or transfer money.
- Provide regulated investment, tax, or credit advice.
- Automatically make financial decisions for users.

---

## 3. Core Product Features

### 3.1 Authentication and User Profile

- Register with name, email, and password.
- Log in and log out securely.
- View and update profile details.
- Configure currency, timezone, and alert preferences.
- Protect all private routes and API endpoints.
- Ensure users can access only their own records.

### 3.2 Transaction Management

Users can create and manage two transaction types:

- `income`
- `expense`

Each transaction includes:

- Amount.
- Transaction type.
- Category.
- Optional subcategory.
- Description.
- Transaction date.
- Optional payment method.
- Optional notes.

Initial categories:

- Food
- Shopping
- Transport
- Education
- Accommodation
- Entertainment
- Health
- Subscriptions
- Personal Care
- Travel
- Other

Categories should be extensible. Custom categories can be added in a
later release.

### 3.3 Financial Dashboard

The dashboard should display:

- Opening balance.
- Total income for the selected period.
- Total expenses for the selected period.
- Current available balance.
- Net cash flow.
- Category-wise expenditure.
- Budget utilisation.
- Recent transactions.
- Relevant alerts and insights.

All financial figures must be calculated by the backend using the user's
records and the selected date range.

### 3.4 Budget Management

- Create monthly overall or category-specific budgets.
- Edit and deactivate budgets.
- View amount spent and amount remaining.
- Display budget utilisation as a percentage.
- Trigger alerts at configurable thresholds.
- Show when a budget has been exceeded.

Formula:

`Budget utilisation (%) = (Eligible spending / Budget limit) × 100`

The backend must define how refunds, edited transactions, deleted
transactions, and date boundaries affect eligible spending.

### 3.5 Rule-Based Smart Alerts

The alert engine should support:

- Budget threshold alerts.
- Budget exceeded alerts.
- Unusually large transaction alerts.
- Rapid or clustered spending alerts.
- Repeated discretionary spending alerts.

Alert thresholds should be configurable. The system must avoid
generating duplicate alerts for the same threshold crossing.

Alerts should be factual, respectful, and non-judgmental. A single
purchase must not be used to label a user as reckless.

### 3.6 Purchase Check --- Signature Feature

Purchase Check is Profligate's primary differentiator and must be
included in Version 1.

Before making a purchase, the user enters:

- Planned purchase amount.
- Description.
- Category.
- Whether the purchase is essential or non-essential.
- Optional planned purchase date.

The backend evaluates the purchase using:

1.  Current available balance.
2.  Remaining overall and category budgets.
3.  Remaining discretionary budget, where configured.
4.  User-entered upcoming commitments, if available.
5.  Relevant financial preferences.

The result should explain:

- Whether the purchase fits within the available budget.
- Which budget or limit may be affected.
- How much money would remain after the purchase.
- A suggested next step.

Possible outcomes:

- `within_budget`
- `near_limit`
- `over_budget`
- `insufficient_recorded_balance`
- `insufficient_data`

The user may choose to proceed, reject the purchase, or place a
non-essential purchase on a 24-hour waiting list.

**Important:** Purchase Check is an advisory feature. It must never
block the user from spending their own money. It must not imply that an
unrecorded bank balance is verified.

### 3.7 AI Financial Insights --- Version 1.1

AI should interpret verified backend calculations and produce
explanations such as:

- Which category increased the most?
- How does this month compare with the previous month?
- What spending patterns deserve attention?
- What practical action could help the user stay within budget?

AI-generated figures must be supported by backend-calculated metrics.

### 3.8 Personalised Recommendations --- Version 1.1

Recommendations may consider:

- Recorded income and expenses.
- Budget utilisation.
- Historical spending patterns.
- User-defined priorities.
- Quality and quantity of available data.

Each recommendation should include an observation, supporting metrics,
suggested action, and estimated impact where calculable.

### 3.9 AI Financial Assistant --- Optional Version 2

Example questions:

- How much did I spend this month?
- What is my largest expense category?
- Compare this month with last month.
- How much did I spend on food this week?
- What is the status of my budgets?
- Can I afford a planned purchase based on my recorded finances?

The assistant must retrieve information through controlled backend
functions. It must never have unrestricted database access.

---

## 4. Technology Stack

---

Layer Technology Responsibility

---

Frontend React User interface

Styling Tailwind CSS Responsive design

Routing React Router Client-side navigation

Server state TanStack Query API fetching, caching,
and synchronisation

Client state React Context Authentication and
theme state

Forms React Hook Form Form handling

Validation Zod Input validation

Charts Recharts Financial visualisation

Backend Node.js Server runtime

API framework Express.js REST API

Database MongoDB Atlas Persistent data storage

ODM Mongoose MongoDB schemas and
queries

Authentication JWT + HttpOnly cookies Authentication

Password hashing bcrypt or Argon2 Password protection

AI One selected LLM API Insights and
provider recommendations

API testing Postman Endpoint testing

Automated testing Vitest/Jest and Unit and API tests
Supertest

Version control Git and GitHub Source control

Frontend hosting Vercel or equivalent Frontend deployment

Backend hosting Render or equivalent API deployment
-----------------------------------------------------------------------

**Architecture decision:** TanStack Query will manage server state.
React Context will be used only for small pieces of shared client state
such as authentication and theme. Redux Toolkit is not required for the
initial project.

---

## 5. Project Folder Structure

The backend follows the Node/Express structure learned from Hitesh
Choudhary's course. Preserve these core folders and entry-point files.

```text
profligate/
│
├── public/
│   └── temp/
│
├── src/
│   ├── controllers/
│   ├── db/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   │
│   ├── app.js
│   ├── constants.js
│   └── index.js
│
├── .env
├── .env.sample
├── .gitignore
├── .prettierignore
├── .prettierrc
├── package-lock.json
├── package.json
└── README.md
```

### 5.1 Backend Folder Responsibilities

---

Folder/File Responsibility

---

`public/temp/` Temporary files, if required. Do
not store sensitive financial
documents here.

`src/controllers/` Handle HTTP requests and responses.

`src/db/` MongoDB connection configuration.

`src/middlewares/` Authentication, validation, error
handling, and other middleware.

`src/models/` Mongoose schemas and models.

`src/routes/` Express route definitions.

`src/utils/` Shared helpers, constants, and
utility functions.

`src/app.js` Configure Express, middleware,
routes, and error handling.

`src/constants.js` Application-wide constants.

`src/index.js` Connect to MongoDB and start the
server.
-----------------------------------------------------------------------

As the application grows, business logic may be separated into service
modules. Keep the original folder structure and add layers only when
they provide a clear benefit.

### 5.2 Frontend Structure

The frontend may be maintained in a separate `client/` directory or a
separate repository.

```text
client/
└── src/
    ├── assets/
    ├── components/
    │   ├── common/
    │   ├── dashboard/
    │   ├── transactions/
    │   ├── budgets/
    │   ├── charts/
    │   └── purchase-check/
    ├── pages/
    │   ├── Landing/
    │   ├── Auth/
    │   ├── Dashboard/
    │   ├── Transactions/
    │   ├── Budgets/
    │   ├── PurchaseCheck/
    │   ├── Insights/
    │   └── Settings/
    ├── hooks/
    ├── layouts/
    ├── routes/
    ├── services/
    ├── context/
    ├── utils/
    ├── App.jsx
    └── main.jsx
```

---

## 6. Database Design

All user-owned records must include a `userId` reference to the
authenticated user.

### 6.1 Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  passwordHash: String,

  currency: "INR",
  timezone: "Asia/Kolkata",

  openingBalancePaise: Number,
  openingBalanceDate: Date,

  preferences: {
    dailyLimitPaise: Number,
    alertEnabled: Boolean,
    aiInsightsEnabled: Boolean
  },

  createdAt: Date,
  updatedAt: Date
}
```

The opening balance is the amount the user reports as available on the
selected starting date. It is not verified against a bank account.

### 6.2 Transactions Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  type: "expense", // income | expense

  amountPaise: Number,
  currency: "INR",

  category: String,
  subcategory: String,

  description: String,
  paymentMethod: String,

  transactionDate: Date,
  notes: String,

  createdAt: Date,
  updatedAt: Date
}
```

Store monetary values as integer paise. For example:

- ₹100 = `10000` paise.
- ₹1,499.50 = `149950` paise.

Do not use floating-point rupee values as the authoritative stored
amount.

### 6.3 Budgets Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  category: String, // "overall" or a category

  amountPaise: Number,
  period: "monthly",

  startDate: Date,
  endDate: Date,

  alertThresholds: [50, 75, 90, 100],

  isActive: Boolean,

  createdAt: Date,
  updatedAt: Date
}
```

Budget spending must be calculated from eligible transactions. Do not
rely on an independently incremented `spentAmount` without
reconciliation.

### 6.4 Notifications Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  type: String,
  title: String,
  message: String,

  severity: "info", // info | warning | danger

  isRead: Boolean,

  relatedTransactionId: ObjectId,

  deduplicationKey: String,

  createdAt: Date
}
```

Use a suitable deduplication strategy so repeated requests do not create
duplicate threshold alerts.

### 6.5 Purchase Checks Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  description: String,
  category: String,

  amountPaise: Number,
  currency: "INR",

  isEssential: Boolean,
  plannedPurchaseDate: Date,

  availableBalancePaise: Number,
  projectedBalancePaise: Number,

  budgetImpact: Object,

  assessment: String,

  status: "pending",
  // pending | proceeded | rejected | expired

  waitingPeriodEndsAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

Store the financial snapshot used for the assessment so the user can
understand what the recommendation was based on. Clearly identify that
the snapshot may become outdated when new transactions are recorded.

### 6.6 Insights Collection --- Version 1.1

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  type: String,
  period: String,

  title: String,
  description: String,

  supportingMetrics: Object,
  recommendations: [String],

  generatedAt: Date
}
```

### 6.7 Future Collections

Introduce these only when their features are implemented:

- `Goals`
- `GoalContributions`
- `Subscriptions`
- `ChatSessions`
- `ChatMessages`
- `PlannedExpenses`

### Database Rules

- Store monetary values as integer paise.
- Validate amounts and dates.
- Use ObjectId references for user ownership.
- Add a unique index to user email.
- Add indexes for transaction queries by user, date, and category.
- Add appropriate unique constraints for active budgets.
- Use timestamps on relevant models.
- Never trust a `userId` received from the client.
- Use database transactions where multiple related financial records
  must change atomically.

---

## 7. Financial Calculation Rules

These calculations must be implemented and tested in the backend.

### 7.1 Available Balance

For a user who has set an opening balance:

`Available balance = Opening balance + Income since opening date - Expenses since opening date`

All values are stored and calculated in paise.

This is a recorded balance, not a live bank balance.

### 7.2 Net Cash Flow

`Net cash flow = Income during period - Expenses during period`

### 7.3 Budget Utilisation

`Budget utilisation (%) = Eligible spending / Budget limit × 100`

Handle zero or invalid budget limits safely.

### 7.4 Projected Purchase Balance

`Projected balance = Current recorded balance - Planned purchase amount`

Purchase Check must also evaluate the relevant remaining budget. A
positive projected balance does not automatically mean a purchase is
affordable.

### 7.5 Financial Calculation Requirements

Test:

- No transactions.
- Income without expenses.
- Expenses without income.
- Opening balance with later transactions.
- Multiple categories.
- Refunds, if supported.
- Month and year boundaries.
- Timezone boundaries.
- Budget utilisation above 100%.
- Edited and deleted transactions.
- Insufficient or missing opening-balance information.

---

## 8. Backend Architecture and API Requirements

### 8.1 Request Lifecycle

1.  Client sends an HTTP request.
2.  Express route receives the request.
3.  Authentication middleware identifies the user.
4.  Validation middleware validates request data.
5.  Controller handles the request.
6.  Business logic performs the operation.
7.  Mongoose accesses MongoDB.
8.  Controller returns a consistent response.

### 8.2 Initial API Endpoints

Base URL: `/api/v1`

Method Endpoint Purpose

---

POST `/auth/register` Register user
POST `/auth/login` Login
POST `/auth/logout` Logout
POST `/auth/refresh` Refresh access token
GET `/users/me` Get current user
PATCH `/users/me` Update profile and preferences
PATCH `/users/opening-balance` Set or update opening balance
GET `/transactions` List transactions
POST `/transactions` Create transaction
GET `/transactions/:id` Get transaction
PATCH `/transactions/:id` Update transaction
DELETE `/transactions/:id` Delete transaction
GET `/dashboard/summary` Dashboard summary
GET `/budgets` List budgets
POST `/budgets` Create budget
PATCH `/budgets/:id` Update budget
DELETE `/budgets/:id` Delete or deactivate budget
GET `/notifications` List notifications
PATCH `/notifications/:id/read` Mark notification read
POST `/purchase-check` Evaluate planned purchase
GET `/purchase-check` List purchase checks
PATCH `/purchase-check/:id/status` Update purchase decision
GET `/insights` List stored insights
POST `/ai/insights/generate` Generate insights
POST `/ai/chat` Optional AI assistant

All private endpoints must authenticate the user and scope database
queries to that user.

### 8.3 API Response Convention

Successful response:

```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": {}
  }
}
```

Error response:

```json
{
  "success": false,
  "message": "Invalid transaction amount",
  "errors": []
}
```

Use appropriate HTTP status codes such as `200`, `201`, `400`, `401`,
`403`, `404`, `409`, `422`, and `500`.

---

## 9. Authentication and Security

### 9.1 Authentication Strategy

Use JWT authentication with secure HttpOnly cookies.

Recommended approach:

- Short-lived access token.
- Secure refresh-token mechanism.
- Refresh-token rotation.
- HttpOnly cookies.
- `Secure` cookies in production.
- Appropriate `SameSite` policy.
- CSRF protection for cookie-authenticated state-changing requests.
- Password hashing using bcrypt or Argon2.
- Logout that invalidates the refresh session.

Do not store authentication tokens in localStorage.

### 9.2 Authorisation

Every private database operation must use the authenticated user's ID.

Example:

```javascript
const transaction = await Transaction.findOne({
  _id: transactionId,
  userId: req.user._id,
});
```

Never fetch a private transaction using only its ID and assume that
possession of the ID grants access.

### 9.3 Additional Security Requirements

- Use HTTPS in production.
- Validate and sanitise incoming data.
- Apply rate limiting.
- Keep API keys in backend environment variables.
- Restrict database credentials and network access.
- Avoid sensitive data in logs.
- Do not expose stack traces in production.
- Protect against CSRF, XSS, and injection attacks.
- Do not send unnecessary personal information to AI providers.

---

## 10. AI Implementation Requirements

AI is an enhancement to the core application, not a dependency for basic
financial operations.

### 10.1 Core Responsibility Split

Component Responsibility

---

JavaScript backend Financial calculations
MongoDB Financial data storage
Rule engine Alert detection
AI provider Interpretation and recommendations
React frontend Display and user interaction

The backend remains the source of truth for financial figures and alert
conditions.

### 10.2 AI Insights Flow

1.  Backend fetches the relevant transactions.
2.  Backend calculates verified financial metrics.
3.  Backend prepares a minimal data summary.
4.  AI interprets the summary.
5.  Backend validates the structured response.
6.  The insight is stored and returned to the frontend.

### 10.3 Smart Alert Flow

1.  A transaction is created, edited, or deleted.
2.  Backend recalculates relevant budget utilisation.
3.  Rule engine checks configured thresholds.
4.  A notification is created if a new threshold condition is met.
5.  Optional AI explanation may be generated separately.

Core alerts must work even when the AI provider is unavailable.

### 10.4 AI Recommendations

Each recommendation should contain:

- Observation.
- Supporting metrics.
- Suggested action.
- Relevant date range.
- Estimated impact, if calculable.
- Clear indication when the estimate is uncertain.

### 10.5 AI Chatbot --- Optional

Future backend tools may include:

- `getMonthlySummary`
- `getCategorySpending`
- `comparePeriods`
- `getBudgetStatus`
- `evaluatePurchase`

The model may request a tool, but the backend validates arguments and
executes a user-scoped function. Never expose unrestricted MongoDB
access to an LLM.

### 10.6 AI Reliability and Safety

- Use one AI provider initially.
- Keep AI integration inside a dedicated backend module.
- Keep provider credentials out of frontend code.
- Validate AI output against a schema.
- Set request timeouts and rate limits.
- Handle provider failures gracefully.
- Minimise the financial data sent to the provider.
- Treat transaction descriptions as untrusted input.
- Never allow AI output to execute arbitrary database queries or code.
- Label estimates clearly.
- Do not present AI recommendations as professional financial advice.

---

## 11. UI/UX Requirements

### 11.1 Design Direction

Use a premium, modern fintech aesthetic.

Recommended design system:

- Dark navy background.
- Emerald green for positive financial indicators.
- Amber for warnings.
- Red for overspending alerts.
- Neutral surfaces and readable typography.
- Consistent spacing and border radius.
- Responsive desktop and mobile layouts.

A user-selectable light theme may be added later.

### 11.2 Required Pages

**MVP** 1. Landing page. 2. Registration page. 3. Login page. 4.
Dashboard. 5. Transactions page. 6. Add/Edit transaction interface. 7.
Budgets page. 8. Purchase Check page or modal. 9. Notifications
interface. 10. Profile and settings page.

**Version 1.1** 11. AI insights page.

**Optional Version 2** 12. AI assistant page. 13. Savings goals page. 14. Subscription management page.

### 11.3 Navigation

```text
Profligate
├── Overview
├── Transactions
├── Budgets
├── Purchase Check
├── Notifications
├── AI Insights
└── Settings
```

Mobile navigation should provide quick access to the most frequently
used sections, with a prominent Add Transaction action.

### 11.4 UX Requirements

- Display understandable form validation errors.
- Show loading and error states during API requests.
- Provide useful empty states for new users.
- Confirm destructive actions.
- Keep alerts visible but non-intrusive.
- Use readable chart labels.
- Display currency consistently.
- Ensure usability on small screens.
- Never rely on colour alone to communicate financial status.

---

## 12. Non-Functional Requirements

### Performance

- Paginate transaction history.
- Add appropriate MongoDB indexes.
- Avoid unnecessary database queries.
- Cache suitable aggregate results when useful.
- Do not block core API requests with long-running AI operations.

### Reliability

- Handle database connection failures.
- Handle AI provider failures.
- Prevent duplicate notifications.
- Test financial calculations.
- Preserve core transaction functionality when AI is unavailable.

### Scalability

- Keep controllers focused on HTTP concerns.
- Separate reusable business logic.
- Use pagination and indexes.
- Introduce background jobs for scheduled reports when needed.
- Keep the AI provider replaceable.

### Accessibility

- Use semantic HTML.
- Ensure adequate contrast.
- Support keyboard navigation.
- Label all form controls.
- Provide accessible chart summaries.

---

## 13. Environment Variables

Create a local `.env` file and maintain `.env.sample` as a safe
template.

Suggested `.env.sample`:

```env
PORT=8000
NODE_ENV=development

MONGODB_URI=mongodb://127.0.0.1:27017/profligate

CLIENT_URL=http://localhost:5173

ACCESS_TOKEN_SECRET=replace_with_a_long_random_secret
ACCESS_TOKEN_EXPIRY=15m

REFRESH_TOKEN_SECRET=replace_with_another_long_random_secret
REFRESH_TOKEN_EXPIRY=7d

AI_PROVIDER=openai
AI_API_KEY=replace_with_your_api_key
AI_MODEL=replace_with_supported_model
```

Adapt AI environment variables to the selected provider.

Generate strong random secrets. Never commit `.env` to GitHub. The
actual cookie and refresh-token implementation must follow the selected
authentication design.

---

## 14. Development Roadmap

Milestone Work Deliverable

---

1 Repository and backend setup Running Express application
2 MongoDB connection and models Database foundation
3 Authentication and authorisation Secure user accounts
4 Transaction APIs and UI Income and expense tracking
5 Opening balance and dashboard Accurate financial overview
6 Budget management Budget tracking
7 Rule-based alerts Working notification engine
8 Purchase Check Signature MVP feature
9 Testing and responsive design Reliable MVP
10 Deployment Publicly accessible application
11 AI insights and recommendations AI-enhanced release
12 Optional advanced features Product expansion

Complete and test each milestone before starting the next.

---

## 15. Testing Requirements

### 15.1 Authentication Tests

- Valid registration.
- Invalid registration.
- Duplicate email registration.
- Valid and invalid login.
- Logout and refresh-token behaviour.
- Protected routes without authentication.
- Expired or invalid tokens.

### 15.2 Ownership and Authorisation Tests

- User A can access User A's transactions.
- User A cannot access User B's transactions.
- User A cannot edit or delete User B's records.
- User A cannot access User B's budgets or purchase checks.
- Client-supplied user IDs cannot override authenticated identity.

### 15.3 Financial Calculation Tests

- Opening balance with no transactions.
- Income without expenses.
- Expenses without income.
- Multiple categories.
- Transactions at month boundaries.
- Budget utilisation at 50%, 75%, 90%, and above 100%.
- Zero or invalid budget limits.
- Edited and deleted transactions.
- Insufficient recorded balance.
- Purchase amount greater than available balance.

### 15.4 Alert Tests

- Threshold crossing creates an alert.
- Repeated requests do not duplicate the alert.
- Editing or deleting a transaction recalculates budget status.
- User alert preferences are respected.
- Core alerts work without an AI provider.

### 15.5 Frontend Tests

- Authentication forms.
- Transaction forms.
- Budget forms.
- Purchase Check interaction.
- Loading and error states.
- Dashboard rendering.
- Responsive layouts.
- API failure handling.

---

## 16. Definition of Done --- MVP

The MVP is complete only when:

- [ ] Users can register, log in, and log out.
- [ ] Authentication uses the selected secure cookie strategy.
- [ ] Users cannot access other users' records.
- [ ] Users can set an opening balance.
- [ ] Users can create, view, edit, and delete transactions.
- [ ] Income and expenses are calculated correctly.
- [ ] Dashboard values are accurate.
- [ ] Users can create and manage budgets.
- [ ] Budget threshold alerts work.
- [ ] Duplicate alerts are prevented.
- [ ] Purchase Check evaluates available balance and relevant budgets.
- [ ] Purchase Check explains its assessment.
- [ ] The application works on desktop and mobile.
- [ ] Critical financial and ownership tests pass.
- [ ] The application is deployed.
- [ ] The README and setup instructions are current.

AI insights and the chatbot are not blockers for MVP completion.

---

## 17. Git and Development Practices

- Use Git from the beginning.
- Commit after every working milestone.
- Use meaningful commit messages.
- Keep `.env` out of version control.
- Maintain `.env.sample`.
- Do not commit `node_modules`.
- Test APIs before frontend integration.
- Review AI-generated code before accepting it.
- Make small, reviewable changes.
- Document important architecture decisions.
- Update this README when requirements change.

Suggested commit messages:

```text
chore: initialize Profligate backend
feat: configure MongoDB connection
feat: implement secure user authentication
feat: add transaction CRUD APIs
feat: implement opening balance management
feat: add financial dashboard summary
feat: implement category budgets
feat: add rule-based spending alerts
feat: implement Purchase Check
test: add financial calculation tests
test: verify user data ownership
```

---

## 18. Architecture Decision Log

Maintain short Architecture Decision Records (ADRs) in a
`docs/decisions/` directory.

Suggested records:

```text
docs/
└── decisions/
    ├── 001-integer-paise.md
    ├── 002-jwt-cookie-authentication.md
    ├── 003-backend-calculates-ai-explains.md
    ├── 004-tanstack-query-and-context.md
    └── 005-rule-based-alert-engine.md
```

Each record should explain:

1.  The decision.
2.  The reason for choosing it.
3.  Alternatives considered.
4.  Trade-offs and consequences.

Important initial decisions:

- Store money as integer paise to avoid floating-point precision
  issues.
- Keep financial calculations in the backend.
- Use deterministic rules for alert detection.
- Use AI for interpretation and recommendations.
- Use HttpOnly cookies for token handling.
- Use TanStack Query for server state and Context for limited client
  state.

---

## 19. Using AI During Development

AI tools may be used extensively to assist with implementation,
debugging, documentation, and testing.

However:

- Understand generated code before accepting it.
- Ask for explanations of unfamiliar implementation choices.
- Review authentication and authorisation code carefully.
- Personally verify financial calculation logic.
- Test cross-user access restrictions.
- Do not allow AI to rewrite unrelated working modules.
- Keep architecture and API contracts consistent.
- Make AI explain the root cause of errors before applying fixes.

The developer must be able to explain the purpose, flow, and trade-offs
of every major module.

---

## 20. Personal Validation and Product Success

The developer should use Profligate to track real expenses over a period
of several weeks.

Measure:

- Whether transactions are easy to record.
- Whether alerts are timely and useful.
- Whether Purchase Check influences purchase decisions.
- Whether budgets are realistic.
- Whether the application helps identify spending patterns.
- Whether any observed spending changes persist.

Possible project metrics:

- Users completing their first transaction.
- Users creating their first budget.
- Weekly active users.
- Purchase Checks completed.
- Percentage of alerts marked useful.
- Budget overruns across comparable periods.

If personal spending changes are mentioned in a resume or project
demonstration, they must be based on genuine recorded data and
comparable time periods.

---

## 21. Final Product Vision

Profligate aims to help students move through three stages:

**Awareness:** Understand where their money goes.

**Control:** Recognise overspending and evaluate purchases before making
them.

**Improvement:** Develop healthier financial habits and make progress
towards savings goals.

Its main differentiator is proactive and explainable spending guidance,
especially the Purchase Check feature.

A successful first release is a secure, tested, deployed application
that solves this focused problem well. Advanced AI features should
strengthen that foundation rather than delay it.

**Profligate --- Spend consciously. Save intentionally.**

---

_Project status: Requirements finalised; implementation not yet
complete._

_This document is the initial product requirements and technical
specification. Update it when implementation decisions are changed._
