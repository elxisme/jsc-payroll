import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb, uuid, date } from "drizzle-orm/pg-core"; // Added 'date'
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication and roles
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("staff"), // super_admin, account_admin, payroll_admin, staff
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Departments table - Need to declare without forward reference first
export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  headOfDepartment: uuid("head_of_department"), // Will add reference later
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff table
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: text("staff_id").notNull().unique(), // JSC/2025/00001
  userId: uuid("user_id").references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  middleName: text("middle_name"),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number"),
  departmentId: uuid("department_id").references(() => departments.id),
  position: text("position").notNull(),
  gradeLevel: integer("grade_level").notNull(), // 1-17
  step: integer("step").notNull(), // 1-15
  employmentDate: timestamp("employment_date").notNull(),
  status: text("status").notNull().default("active"), // active, on_leave, retired, terminated
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  pensionPin: text("pension_pin"),
  taxPin: text("tax_pin"),
  nextOfKin: jsonb("next_of_kin"), // JSON object with next of kin details
  documents: jsonb("documents"), // Array of document URLs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Salary structure table (CONJUSS)
export const salaryStructure = pgTable("salary_structure", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  gradeLevel: integer("grade_level").notNull(),
  step: integer("step").notNull(),
  basicSalary: decimal("basic_salary", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Allowances table
export const allowances = pgTable("allowances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // percentage, fixed
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Deductions table
export const deductions = pgTable("deductions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // percentage, fixed
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payroll runs table
export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  period: text("period").notNull(), // "2025-01"
  departmentId: uuid("department_id").references(() => departments.id),
  status: text("status").notNull().default("draft"), // draft, pending_review, approved, processed
  totalStaff: integer("total_staff"),
  grossAmount: decimal("gross_amount", { precision: 15, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 15, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  createdBy: uuid("created_by").references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), // Add this line
});

// Payslips table
export const payslips = pgTable("payslips", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: uuid("staff_id").references(() => staff.id),
  payrollRunId: uuid("payroll_run_id").references(() => payrollRuns.id),
  period: text("period").notNull(),
  basicSalary: decimal("basic_salary", { precision: 15, scale: 2 }),
  allowances: jsonb("allowances"), // JSON object with allowance breakdowns
  deductions: jsonb("deductions"), // JSON object with deduction breakdowns
  grossPay: decimal("gross_pay", { precision: 15, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 15, scale: 2 }),
  netPay: decimal("net_pay", { precision: 15, scale: 2 }),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // info, warning, error, success
  isRead: boolean("is_read").default(false),
  data: jsonb("data"), // Additional data for the notification
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Staff individual allowances table (overtime, bonuses, etc.)
export const staffIndividualAllowances = pgTable("staff_individual_allowances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }).notNull(),
  payrollRunId: uuid("payroll_run_id").references(() => payrollRuns.id, { onDelete: "set null" }),
  type: text("type").notNull(), // 'overtime', 'bonus', 'commission', 'special_duty'
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  period: text("period").notNull(), // '2025-01' format
  description: text("description"),
  status: text("status").notNull().default("pending"), // 'pending', 'applied', 'cancelled'
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff individual deductions table (loans, advances, fines, etc.)
export const staffIndividualDeductions = pgTable("staff_individual_deductions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }).notNull(),
  payrollRunId: uuid("payroll_run_id").references(() => payrollRuns.id, { onDelete: "set null" }),
  type: text("type").notNull(), // 'loan_repayment', 'salary_advance', 'fine', 'cooperative'
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // Amount for current period
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }), // Total loan/advance amount
  remainingBalance: decimal("remaining_balance", { precision: 15, scale: 2 }), // Outstanding balance
  period: text("period").notNull(), // '2025-01' format
  startPeriod: text("start_period"), // When deduction started
  endPeriod: text("end_period"), // When deduction should end
  description: text("description"),
  status: text("status").notNull().default("active"), // 'active', 'paid_off', 'cancelled'
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promotions table (New Table)
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  oldGradeLevel: integer("old_grade_level").notNull(),
  oldStep: integer("old_step").notNull(),
  newGradeLevel: integer("new_grade_level").notNull(),
  newStep: integer("new_step").notNull(),
  effectiveDate: date("effective_date").notNull(),
  promotionType: text("promotion_type").notNull().default("regular"), // regular, acting, temporary, demotion
  reason: text("reason"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  staffId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertStaffIndividualAllowanceSchema = createInsertSchema(staffIndividualAllowances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffIndividualDeductionSchema = createInsertSchema(staffIndividualDeductions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// New Insert Schema for Promotions
export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});


// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;

export type SalaryStructure = typeof salaryStructure.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;
export type Deduction = typeof deductions.$inferSelect;

export type PayrollRun = typeof payrollRuns.$inferSelect;
export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>;

export type Payslip = typeof payslips.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;

export type StaffIndividualAllowance = typeof staffIndividualAllowances.$inferSelect;
export type InsertStaffIndividualAllowance = z.infer<typeof insertStaffIndividualAllowanceSchema>;

export type StaffIndividualDeduction = typeof staffIndividualDeductions.$inferSelect;
export type InsertStaffIndividualDeduction = z.infer<typeof insertStaffIndividualDeductionSchema>;

// New Types for Promotions
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;


// Leave Types table
export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  isPaid: boolean("is_paid").notNull().default(true),
  maxDaysPerYear: integer("max_days_per_year").notNull().default(30),
  accrualRate: decimal("accrual_rate", { precision: 5, scale: 2 }).notNull().default("2.5"),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leave Requests table
export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  leaveTypeId: uuid("leave_type_id").notNull().references(() => leaveTypes.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, cancelled
  requestedBy: uuid("requested_by").references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvalComments: text("approval_comments"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff Leave Balances table
export const staffLeaveBalances = pgTable("staff_leave_balances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  leaveTypeId: uuid("leave_type_id").notNull().references(() => leaveTypes.id),
  year: integer("year").notNull(),
  accruedDays: decimal("accrued_days", { precision: 5, scale: 2 }).notNull().default("0"),
  usedDays: decimal("used_days", { precision: 5, scale: 2 }).notNull().default("0"),
  remainingDays: decimal("remaining_days", { precision: 5, scale: 2 }).notNull().default("0"),
  carriedForward: decimal("carried_forward", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for leave management
export const insertLeaveTypeSchema = createInsertSchema(leaveTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffLeaveBalanceSchema = createInsertSchema(staffLeaveBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for leave management
export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = z.infer<typeof insertLeaveTypeSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type StaffLeaveBalance = typeof staffLeaveBalances.$inferSelect;
export type InsertStaffLeaveBalance = z.infer<typeof insertStaffLeaveBalanceSchema>;
