#!/usr/bin/env node
// Database initialization script for JSC Payroll Management System
// Run this file to set up sample data after running database-schema.sql

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing JSC Payroll Database...');

    // Get departments for reference
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, code')
      .limit(5);

    if (deptError) {
      console.error('Error fetching departments:', deptError);
      return;
    }

    console.log(`✅ Found ${departments.length} departments`);

    // Insert sample staff members
    const sampleStaff = [];
    const positions = [
      'Chief Judge',
      'Justice',
      'Registrar',
      'Deputy Registrar',
      'Court Clerk',
      'Administrative Officer',
      'Accountant',
      'ICT Officer',
      'Security Officer',
      'Driver'
    ];

    const bankNames = ['access', 'gtb', 'firstbank', 'zenith', 'uba', 'fidelity', 'union'];
    
    for (let i = 1; i <= 50; i++) {
      const deptIndex = i % departments.length;
      const position = positions[i % positions.length];
      const gradeLevel = Math.floor(Math.random() * 17) + 1;
      const step = Math.floor(Math.random() * 15) + 1;
      const bankName = bankNames[i % bankNames.length];
      
      sampleStaff.push({
        staff_id: `JSC/2025/${String(i).padStart(5, '0')}`,
        first_name: `John${i}`,
        last_name: `Doe${i}`,
        middle_name: i % 3 === 0 ? `Middle${i}` : null,
        email: `staff${i}@jsc.gov.ng`,
        phone_number: `080${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
        department_id: departments[deptIndex].id,
        position: position,
        grade_level: gradeLevel,
        step: step,
        employment_date: new Date(2020 + (i % 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        status: i > 45 ? 'on_leave' : 'active',
        bank_name: bankName,
        account_number: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        account_name: `John${i} Doe${i}`,
        tax_pin: `TIN${String(i).padStart(6, '0')}`,
        pension_pin: `PEN${String(i).padStart(6, '0')}`
      });
    }

    console.log('📝 Inserting staff members...');
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .insert(sampleStaff)
      .select();

    if (staffError) {
      console.error('Error inserting staff:', staffError);
      return;
    }

    console.log(`✅ Inserted ${staffData.length} staff members`);

    // Create payroll run for current month
    const currentMonth = new Date().toISOString().slice(0, 7); // "2025-01"
    
    console.log('💰 Creating payroll run...');
    const { data: payrollRun, error: payrollError } = await supabase
      .from('payroll_runs')
      .insert({
        period: currentMonth,
        status: 'processed',
        total_staff: staffData.length,
        gross_amount: staffData.length * 150000, // Estimated
        total_deductions: staffData.length * 30000, // Estimated
        net_amount: staffData.length * 120000, // Estimated
      })
      .select()
      .single();

    if (payrollError) {
      console.error('Error creating payroll run:', payrollError);
      return;
    }

    console.log('✅ Created payroll run');

    // Create payslips for all staff
    console.log('📄 Creating payslips...');
    const payslips = [];
    
    for (const staff of staffData) {
      // Get basic salary from salary structure
      const { data: salaryData } = await supabase
        .from('salary_structure')
        .select('basic_salary')
        .eq('grade_level', staff.grade_level)
        .eq('step', staff.step)
        .single();

      const basicSalary = salaryData ? parseFloat(salaryData.basic_salary) : 100000;
      
      // Calculate allowances (simplified)
      const housingAllowance = basicSalary * 0.4;
      const transportAllowance = basicSalary * 0.2;
      const medicalAllowance = basicSalary * 0.1;
      const totalAllowances = housingAllowance + transportAllowance + medicalAllowance;
      
      // Calculate deductions (simplified)
      const pension = basicSalary * 0.08;
      const tax = basicSalary * 0.075;
      const nhf = basicSalary * 0.025;
      const totalDeductions = pension + tax + nhf;
      
      const grossPay = basicSalary + totalAllowances;
      const netPay = grossPay - totalDeductions;

      payslips.push({
        staff_id: staff.id,
        payroll_run_id: payrollRun.id,
        period: currentMonth,
        basic_salary: basicSalary,
        allowances: {
          housing: housingAllowance,
          transport: transportAllowance,
          medical: medicalAllowance
        },
        deductions: {
          pension: pension,
          tax: tax,
          nhf: nhf
        },
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        net_pay: netPay
      });
    }

    const { error: payslipError } = await supabase
      .from('payslips')
      .insert(payslips);

    if (payslipError) {
      console.error('Error creating payslips:', payslipError);
      return;
    }

    console.log(`✅ Created ${payslips.length} payslips`);

    // Create sample notifications
    console.log('🔔 Creating notifications...');
    const notifications = [
      {
        title: 'Payroll Processed',
        message: `Payroll for ${currentMonth} has been successfully processed.`,
        type: 'success'
      },
      {
        title: 'New Staff Added',
        message: '50 new staff members have been added to the system.',
        type: 'info'
      },
      {
        title: 'Bank Transfer Ready',
        message: 'Bank transfer files are ready for download.',
        type: 'info'
      },
      {
        title: 'System Maintenance',
        message: 'Scheduled maintenance on Sunday 2:00 AM - 4:00 AM.',
        type: 'warning'
      }
    ];

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('Error creating notifications:', notificationError);
      return;
    }

    console.log('✅ Created sample notifications');

    console.log('🎉 Database initialization completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${departments.length} departments`);
    console.log(`- ${staffData.length} staff members`);
    console.log(`- 1 payroll run`);
    console.log(`- ${payslips.length} payslips`);
    console.log(`- ${notifications.length} notifications`);
    console.log('\n✅ Your JSC Payroll Management System is ready to use!');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Run the initialization
initializeDatabase();