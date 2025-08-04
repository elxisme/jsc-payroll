# Overview

The Judicial Service Committee (JSC) Payroll Management System is a comprehensive payroll and staff management application designed for Nigerian government institutions. Built with React, TypeScript, and Supabase, it provides role-based access control for managing staff records, processing payroll, generating reports, and handling departmental organization. The system implements the Nigerian CONJUSS (Consolidated Judicial Salary Structure) salary calculations and supports bank transfer file generation for payroll disbursement.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Framework
- **React with TypeScript**: Component-based architecture using functional components and hooks
- **Vite**: Fast development build tool with hot module replacement
- **TailwindCSS + shadcn/ui**: Utility-first CSS framework with pre-built component library
- **Wouter**: Lightweight client-side routing
- **React Query**: Server state management and caching

## Authentication & Authorization
- **Supabase Auth**: Handles user authentication with email/password
- **Role-Based Access Control**: Four user roles (super_admin, account_admin, payroll_admin, staff)
- **AuthGuard Components**: Protect routes based on user roles and authentication status
- **Session Management**: Automatic token refresh and persistent sessions

## State Management
- **React Query**: Manages server state, caching, and API synchronization
- **React Context**: Global auth state and user session management
- **React Hook Form**: Form state management with Zod validation
- **Local Component State**: UI state management with useState/useReducer

## Database Architecture
- **PostgreSQL via Supabase**: Relational database with real-time subscriptions
- **Drizzle ORM**: Type-safe database queries and schema management
- **Database Schema**: 
  - Users table for authentication and roles
  - Staff table for employee records with CONJUSS grade levels
  - Departments table for organizational structure
  - Payroll tables for salary processing and history
  - Payslips table for individual payment records

## UI/UX Design Patterns
- **Responsive Design**: Mobile-first approach using Tailwind breakpoints
- **Component Library**: shadcn/ui components with consistent styling
- **Nigerian Government Branding**: Custom color scheme with green and navy themes
- **Layout System**: Sidebar navigation with top bar for authenticated users
- **Toast Notifications**: User feedback for actions and errors

## File Management & Exports
- **PDF Generation**: jsPDF for payslip generation with Nigerian formatting
- **Excel Export**: XLSX library for payroll and bank transfer reports
- **CSV Export**: Bank transfer file generation for payment processing
- **File Downloads**: Browser-based file download functionality

## Business Logic
- **CONJUSS Salary Calculations**: Nigerian judicial salary structure implementation
- **Payroll Processing**: Automated salary calculations with allowances and deductions
- **Bank Integration**: Export formats for Nigerian banking systems
- **Grade Level Management**: Support for levels 1-17 with steps 1-15
- **Department Hierarchy**: Organizational structure with head assignments

# External Dependencies

## Core Services
- **Supabase**: Backend-as-a-Service providing PostgreSQL database, authentication, and real-time features
- **Neon Database**: PostgreSQL hosting (alternative/backup to Supabase)

## Payment & Banking
- **Nigerian Banking System**: Integration points for bank transfer file formats
- **CONJUSS Salary Structure**: Nigerian government salary calculation standards

## Development Tools
- **TypeScript**: Type safety and developer experience
- **Drizzle Kit**: Database migrations and schema management
- **Vite**: Development server and build optimization
- **ESBuild**: Fast JavaScript bundling for production

## UI Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Lucide React**: Icon library with consistent styling
- **date-fns**: Date manipulation and formatting utilities
- **React Hook Form**: Form validation and state management
- **Zod**: Runtime type validation and schema definition

## File Processing
- **jsPDF**: PDF generation for payslips and reports
- **XLSX**: Excel file generation and manipulation
- **File System API**: Browser-based file downloads and uploads