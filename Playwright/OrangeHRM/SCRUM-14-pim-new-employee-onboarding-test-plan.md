# SCRUM-14 — PIM Module: New Employee Onboarding

## Application Overview

Test plan for GitHub Issue #8 / Jira SCRUM-14 — New Employee Onboarding in the OrangeHRM PIM (Personal Information Management) module. Covers the full Add Employee workflow: minimal required-field creation, optional field population, profile photo upload, login credential provisioning (Enabled and Disabled status), post-creation profile tab navigation, Employee List verification, Cancel behaviour, and a comprehensive suite of negative/validation tests. Base URL: https://opensource-demo.orangehrmlive.com. All tests reuse the authenticated Admin session saved by seed.spec.ts (storageState: .auth/admin.json). Dynamic test data uses timestamp suffixes to prevent collisions. All tests that create employees include an afterAll teardown step to delete the created record. File naming follows the convention {app-prefix}-tc-{story-id}-{type}-{seq:02d}-{kebab-description}.spec.ts. Tests are placed under Playwright/OrangeHRM/tests/orangehrm-e2e/pim/.

## Test Scenarios

### 1. PIM — New Employee Onboarding — Happy Path

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 1.1. TC-SCRUM-14-HP-01: Add new employee with required fields only (First Name and Last Name)

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-01-add-employee-required-fields.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: The Add Employee form is displayed with a heading 'Add Employee'
    - expect: First Name, Middle Name, and Last Name text fields are visible
    - expect: Employee Id field is pre-populated with an auto-generated value
    - expect: Profile photo upload area shows 'Accepts jpg, .png, .gif up to 1MB'
    - expect: 'Create Login Details' checkbox is unchecked by default
    - expect: Save and Cancel buttons are both visible
  2. Enter a unique first name (e.g., 'OnboardHP01' + Date.now()) in the First Name field using pressSequentially to trigger validation
    - expect: First Name field displays the entered value
  3. Leave Middle Name empty and enter a unique last name (e.g., 'SCRUM14_' + Date.now()) in the Last Name field
    - expect: Last Name field displays the entered value
    - expect: Middle Name field remains empty
  4. Leave the Employee Id as the auto-generated value
    - expect: Employee Id field retains its pre-populated value
  5. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: User is redirected to the new employee's Personal Details profile page
    - expect: A success toast notification containing 'Successfully Saved' appears
    - expect: The employee's First Name and Last Name appear in the profile header
    - expect: The Personal Details tab is active by default
  6. (afterAll teardown) Navigate to /web/index.php/pim/viewEmployeeList, search by the test employee's first name, click the delete icon in the Actions column, and confirm deletion in the dialog
    - expect: The confirmation dialog appears asking 'Are you sure you want to Delete?'
    - expect: After confirming, a success toast 'Successfully Deleted' appears
    - expect: The test employee no longer appears in the Employee List

#### 1.2. TC-SCRUM-14-HP-02: Add new employee with optional Middle Name and custom Employee ID

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-02-add-employee-optional-fields.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed with all three name fields and Employee Id field
  2. Enter 'John' in First Name, 'Michael' in Middle Name, and 'CustomOpt_' + Date.now() in Last Name
    - expect: First Name field shows 'John'
    - expect: Middle Name field shows 'Michael'
    - expect: Last Name field shows the timestamped value
  3. Clear the auto-generated Employee Id and type a unique custom ID (e.g., 'CID' + Date.now().toString().slice(-6))
    - expect: Employee Id field displays the custom ID value
  4. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: User is redirected to the new employee's Personal Details page
    - expect: A success toast notification appears
    - expect: Employee name 'John Michael CustomOpt_[timestamp]' is displayed in the profile header
  5. (afterAll teardown) Navigate to the Employee List, search for 'John', find the created employee, click the delete icon, and confirm in the dialog
    - expect: Test employee is successfully deleted from the system

#### 1.3. TC-SCRUM-14-HP-03: Add employee with Create Login Details enabled (Status: Enabled)

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-03-add-employee-with-login-enabled.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
    - expect: 'Create Login Details' checkbox is unchecked
  2. Enter 'LoginEn_' + Date.now() in First Name and 'SCRUM14' in Last Name
    - expect: Name fields display the entered values
  3. Check the 'Create Login Details' checkbox using getByLabel('Create Login Details') or getByRole('checkbox', { name: 'Create Login Details' })
    - expect: A login details section expands below the checkbox
    - expect: Username, Password, and Confirm Password fields become visible
    - expect: A Status toggle with 'Enabled' and 'Disabled' options is visible
    - expect: Status defaults to 'Enabled'
  4. Enter a unique username (e.g., 'emp.en.' + Date.now()) in the Username field
    - expect: Username field shows the entered value
  5. Enter 'TestPwd@2024' in the Password field
    - expect: Password field accepts the value (characters are masked)
  6. Enter 'TestPwd@2024' in the Confirm Password field
    - expect: Confirm Password field accepts the matching value
  7. Verify the Status toggle is set to 'Enabled' (toggle if necessary)
    - expect: Status shows 'Enabled'
  8. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: User is redirected to the new employee's Personal Details page
    - expect: A success toast notification 'Successfully Saved' appears
    - expect: Employee name is displayed in the profile header
  9. (afterAll teardown) Delete the created test employee via Employee List search and delete
    - expect: Test employee is successfully removed from the system

#### 1.4. TC-SCRUM-14-HP-04: Add employee with Create Login Details enabled (Status: Disabled)

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-04-add-employee-with-login-disabled.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
    - expect: 'Create Login Details' checkbox is unchecked
  2. Enter 'LoginDis_' + Date.now() in First Name and 'SCRUM14' in Last Name
    - expect: Name fields display the entered values
  3. Check the 'Create Login Details' checkbox
    - expect: Login details section expands showing Username, Password, Confirm Password fields and Status toggle
  4. Enter a unique username (e.g., 'emp.dis.' + Date.now()) in the Username field
    - expect: Username field shows the entered value
  5. Enter 'TestPwd@2024' in both Password and Confirm Password fields
    - expect: Both password fields accept the matching values
  6. Click the Status toggle to set it to 'Disabled'
    - expect: Status toggle shows 'Disabled'
  7. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: User is redirected to the new employee's Personal Details page
    - expect: A success toast notification appears
    - expect: Employee name is visible in the profile header
  8. (afterAll teardown) Delete the created test employee via Employee List search and delete
    - expect: Test employee is successfully removed from the system

#### 1.5. TC-SCRUM-14-HP-05: Add employee with profile photo upload

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-05-add-employee-with-photo.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
    - expect: Profile photo upload area is visible with hint text 'Accepts jpg, .png, .gif up to 1MB'
  2. Enter 'PhotoTest_' + Date.now() in First Name and 'SCRUM14' in Last Name
    - expect: Name fields display the entered values
  3. Click the profile photo upload button (camera/edit icon on the avatar placeholder) and upload a valid JPG image file under 1MB
    - expect: The file chooser dialog opens
    - expect: After file selection, the profile photo area updates to show a preview of the uploaded image
  4. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: User is redirected to the new employee's Personal Details page
    - expect: A success toast notification appears
    - expect: The uploaded profile image is displayed in the employee profile header
  5. (afterAll teardown) Delete the created test employee via Employee List search and delete
    - expect: Test employee is successfully removed from the system

#### 1.6. TC-SCRUM-14-HP-06: Verify newly onboarded employee appears in Employee List

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-06-verify-employee-in-list.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
  2. Enter 'ListVirf_' + Date.now() in First Name and 'SCRUM14' in Last Name, then click the Save button
    - expect: User is redirected to the new employee's Personal Details page
    - expect: A success toast notification appears
  3. Navigate to /web/index.php/pim/viewEmployeeList
    - expect: Employee List page is displayed with the Employee Information search form
    - expect: A results table with columns: Id, First (& Middle) Name, Last Name, Job Title, Employment Status, Sub Unit, Supervisor, Actions is visible
  4. Type the created employee's first name (with timestamp) in the Employee Name search field, wait for the autocomplete suggestion, select it, then click the Search button
    - expect: The results table updates to show only the created employee
    - expect: Record count at the top reflects at least one matching result
  5. Verify the employee row in the table matches the created employee's First Name and Last Name
    - expect: Employee's First Name column shows 'ListVirf_[timestamp]'
    - expect: Employee's Last Name column shows 'SCRUM14'
    - expect: An edit (pencil) icon and delete (trash) icon are present in the Actions column
  6. (afterAll teardown) Click the delete icon in the test employee's Actions column and confirm deletion
    - expect: Confirmation dialog appears
    - expect: After confirmation, success toast 'Successfully Deleted' appears
    - expect: Employee is no longer in the list

#### 1.7. TC-SCRUM-14-HP-07: Employee profile tabs are accessible immediately after onboarding

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-07-employee-profile-tabs.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee, enter 'TabTest_' + Date.now() in First Name and 'SCRUM14' in Last Name, then click Save
    - expect: User is redirected to the new employee's Personal Details profile page
    - expect: A success toast notification appears
  2. Verify the profile tab menu is visible on the page
    - expect: The following tabs are visible: Personal Details, Contact Details, Emergency Contacts, Dependants, Job, Salary, Reports To, Qualifications, Memberships
    - expect: 'Personal Details' tab is highlighted/active by default
  3. Click on the 'Contact Details' tab
    - expect: Contact Details section is displayed
    - expect: Address fields (Street 1, Street 2, City, State/Province, Zip/Postal Code, Country) are visible
    - expect: Contact fields (Home Telephone, Mobile, Work Telephone, Work Email) are visible
  4. Click on the 'Job' tab
    - expect: Job Details section is displayed
    - expect: Job Title, Employment Status, and Join Date fields (or sub-unit/location fields) are visible
    - expect: A Save button is present in the section
  5. (afterAll teardown) Navigate to the Employee List, search for 'TabTest_[timestamp]', and delete the test employee
    - expect: Test employee is successfully removed from the system

#### 1.8. TC-SCRUM-14-HP-08: Cancel Add Employee form returns to list without creating a record

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-scrum-14-hp-08-cancel-add-employee.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed with Save and Cancel buttons
  2. Enter 'CancelHP08Test' in First Name and 'SCRUM14Cancel' in Last Name
    - expect: First Name field shows 'CancelHP08Test'
    - expect: Last Name field shows 'SCRUM14Cancel'
  3. Click the Cancel button
    - expect: User is redirected away from the Add Employee form
    - expect: The current URL no longer contains 'pim/addEmployee'
    - expect: No save confirmation toast appears
  4. Navigate to /web/index.php/pim/viewEmployeeList and search for 'CancelHP08Test' in the Employee Name field, then click Search
    - expect: No employee named 'CancelHP08Test SCRUM14Cancel' appears in the results
    - expect: A 'No Records Found' message or zero-record count is displayed, confirming the form was not saved

### 2. PIM — New Employee Onboarding — Negative / Validation

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 2.1. TC-SCRUM-14-NEG-01: Submit Add Employee form with all required fields empty shows validation errors

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-scrum-14-neg-01-all-fields-empty.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
    - expect: First Name and Last Name fields are empty by default
  2. Leave both First Name and Last Name fields empty and click the Save button using getByRole('button', { name: 'Save' })
    - expect: A 'Required' validation error message appears below the First Name field
    - expect: A 'Required' validation error message appears below the Last Name field
    - expect: The form does not submit — user remains on the Add Employee page
    - expect: The page heading 'Add Employee' is still visible

#### 2.2. TC-SCRUM-14-NEG-02: Submit Add Employee form with First Name empty shows required error

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-scrum-14-neg-02-first-name-empty.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
  2. Leave the First Name field empty and enter 'SCRUM14' in the Last Name field
    - expect: Last Name field shows 'SCRUM14'
    - expect: First Name field is empty
  3. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: A 'Required' validation error appears below the First Name field
    - expect: No validation error appears under the Last Name field
    - expect: The form does not submit — the 'Add Employee' heading is still visible

#### 2.3. TC-SCRUM-14-NEG-03: Submit Add Employee form with Last Name empty shows required error

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-scrum-14-neg-03-last-name-empty.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
  2. Enter 'FirstNegTest' in the First Name field and leave the Last Name field empty
    - expect: First Name field shows 'FirstNegTest'
    - expect: Last Name field is empty
  3. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: A 'Required' validation error appears below the Last Name field
    - expect: No validation error appears under the First Name field
    - expect: The form does not submit — the 'Add Employee' heading is still visible

#### 2.4. TC-SCRUM-14-NEG-04: Submit Add Employee form with a duplicate Employee ID shows error

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-scrum-14-neg-04-duplicate-employee-id.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/viewEmployeeList and note the Employee Id from the first row of the results table
    - expect: Employee List page is displayed with at least one employee record
    - expect: An existing Employee Id value is visible and noted for use in the next steps
  2. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
  3. Enter 'DupIdNeg_' + Date.now() in First Name and 'Test' in Last Name
    - expect: Name fields display the entered values
  4. Clear the auto-generated Employee Id field and enter the existing Employee Id noted from the Employee List
    - expect: Employee Id field shows the duplicated value
  5. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: An error message appears indicating 'Employee Id already exists' (or equivalent wording)
    - expect: The form does not submit — the 'Add Employee' heading is still visible

#### 2.5. TC-SCRUM-14-NEG-05: Create Login Details with an already-used username shows 'Already exists' error

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-scrum-14-neg-05-duplicate-username.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
  2. Enter 'DupUserNeg_' + Date.now() in First Name and 'Test' in Last Name
    - expect: Name fields display the entered values
  3. Check the 'Create Login Details' checkbox
    - expect: Login details section expands with Username, Password, Confirm Password fields and Status toggle
  4. Enter 'Admin' in the Username field (a username known to already exist in the demo system)
    - expect: Username field shows 'Admin'
  5. Enter 'TestPwd@2024' in both the Password and Confirm Password fields
    - expect: Both password fields are filled with the same value
  6. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: A validation error message 'Already exists' (or equivalent) appears near the Username field
    - expect: The form does not submit — the 'Add Employee' heading is still visible

#### 2.6. TC-SCRUM-14-NEG-06: Create Login Details with mismatched Password and Confirm Password shows mismatch error

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-scrum-14-neg-06-password-mismatch.spec.ts`

**Steps:**
  1. Navigate to /web/index.php/pim/addEmployee
    - expect: Add Employee form is displayed
  2. Enter 'PwdMismNeg_' + Date.now() in First Name and 'Test' in Last Name
    - expect: Name fields display the entered values
  3. Check the 'Create Login Details' checkbox
    - expect: Login details section expands with Username, Password, Confirm Password fields
  4. Enter a unique username (e.g., 'pwd.mismatch.' + Date.now()) in the Username field
    - expect: Username field shows the entered value
  5. Enter 'TestPwd@2024' in the Password field
    - expect: Password field accepts the input
  6. Enter 'DifferentPwd@9999' in the Confirm Password field (intentionally different from the Password value)
    - expect: Confirm Password field shows a value that differs from the Password
  7. Click the Save button using getByRole('button', { name: 'Save' })
    - expect: A validation error message 'Passwords do not match' (or equivalent) appears near the Confirm Password field
    - expect: The form does not submit — the 'Add Employee' heading is still visible
