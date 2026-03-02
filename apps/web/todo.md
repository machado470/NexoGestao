# NexoGestão SaaS Platform - TODO

## Completed Features
- [x] Landing page with hero section, features, and CTA buttons
- [x] Authentication system (register/login) using tRPC
- [x] Local database (MySQL) with organizations and accounts tables
- [x] Dashboard with sidebar navigation, dark/light theme toggle
- [x] Database migrations for organizations and accounts
- [x] AuthContext with tRPC integration
- [x] Create Customer Modal component
- [x] Create Appointment Modal component
- [x] Create Service Order Modal component
- [x] Integrated modals into Dashboard
- [x] Unit tests for CRUD operations (customers, appointments, service orders)
- [x] Fixed logout test (session.logout instead of auth.logout)
- [x] Implemented bcrypt for password hashing
- [x] Added email and phone validation in forms
- [x] Fixed imports in Dashboard (useAuth hook)
- [x] Verified database schema synchronization

## In Progress
- [ ] Implement data tables to display created records
- [ ] Create Finance/Charges management section
- [ ] Create People/Collaborators management section
- [ ] Create Governance section with risk scoring

## Pending Features
- [ ] Data visualization with Recharts (revenue trends, appointment distribution, risk scores)
- [ ] Email verification and password recovery
- [ ] Real-time notifications system
- [ ] WhatsApp integration for automated messages
- [ ] Sync with real NexoGestao API when available
- [ ] Export data to PDF/Excel
- [ ] User profile management
- [ ] Organization settings and customization
- [ ] Role-based access control (RBAC)
- [ ] Audit logs for all operations
- [ ] API rate limiting and security

## Database Schema Status
- [x] organizations table
- [x] accounts table
- [x] customers table
- [x] appointments table
- [x] service_orders table
- [ ] charges table
- [ ] payments table
- [ ] people table
- [ ] risk_snapshots table

## Testing Status
- [x] CRUD operations tests (customers, appointments, service orders)
- [ ] Modal component tests
- [ ] Form validation tests
- [ ] Authentication flow tests
- [ ] Integration tests for dashboard
