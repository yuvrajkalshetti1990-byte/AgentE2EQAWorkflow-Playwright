# SCRUM-9 OrangeHRM Employee Lifecycle (PIM) Test Plan

## Application Overview

End-to-end test plan for SCRUM-9 — Employee Lifecycle management in the OrangeHRM PIM (Personal Information Management) module. Covers the full employee lifecycle: adding employees, searching/filtering the employee list, editing employee personal details, and deleting employees. Base URL: https://opensource-demo.orangehrmlive.com. All tests assume the Admin user is authenticated (session reused from seed.spec.ts). Tests are scoped to the PIM module accessible via the left navigation sidebar.

## Test Scenarios

### 1. Happy Path – Add Employee

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 1.1. TC-PIM-HP-01: Add a new employee with required fields only

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-01-add-employee-required-fields.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee page (/web/index.php/pim/addEmployee)
    - expect: Add Employee form is displayed
    - expect: First Name, Middle Name, and Last Name text fields are visible
    - expect: Employee Id field is pre-populated with an auto-generated value
    - expect: Save and Cancel buttons are present
  2. Clear any pre-filled values and type 'Test' in the First Name field
    - expect: First Name field contains 'Test'
  3. Leave Middle Name empty and type 'Automation' in the Last Name field
    - expect: Last Name field contains 'Automation'
    - expect: Middle Name field remains empty
  4. Note the auto-generated Employee Id value shown in the Employee Id field
    - expect: Employee Id field is pre-populated (e.g. '0428')
  5. Click the Save button
    - expect: User is redirected to the new employee's Personal Details profile page
    - expect: A success toast notification appears confirming the save
    - expect: The employee name 'Test Automation' is displayed in the profile header
    - expect: The Personal Details tab is active by default
  6. Navigate back to PIM > Employee List and search for the newly added employee by first name 'Test'
    - expect: The employee 'Test Automation' appears in the search results table

#### 1.2. TC-PIM-HP-02: Add a new employee with all fields including login details

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-02-add-employee-with-login.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee page (/web/index.php/pim/addEmployee)
    - expect: Add Employee form is displayed with First Name, Middle Name, Last Name fields and Employee Id
  2. Enter 'John' in First Name, 'Michael' in Middle Name, and 'Doe' in Last Name
    - expect: All three name fields are filled with the entered values
  3. Clear the default Employee Id and enter a unique value (e.g. 'EMP999')
    - expect: Employee Id field shows 'EMP999'
  4. Check the 'Create Login Details' checkbox
    - expect: A section expands below showing Username and Password fields and a Status toggle (Enabled/Disabled)
  5. Enter a unique username (e.g. 'john.doe.test') in the Username field and a valid password (e.g. 'Password@123') in the Password field. Set Status to Enabled.
    - expect: Username and Password fields are filled
    - expect: Status is set to Enabled
  6. Click the Save button
    - expect: User is redirected to the new employee's Personal Details page
    - expect: Success toast notification is displayed
    - expect: Employee name 'John Michael Doe' appears in the profile header

#### 1.3. TC-PIM-HP-03: Add employee with profile photo upload

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-03-add-employee-with-photo.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee page
    - expect: Add Employee form is displayed with a profile photo upload area and hint text 'Accepts jpg, .png, .gif up to 1MB'
  2. Click the 'Choose File' button and upload a valid JPG image under 1MB
    - expect: The profile picture area updates to show a preview of the uploaded image
  3. Enter 'Photo' in First Name and 'Test' in Last Name, then click Save
    - expect: User is redirected to the new employee's Personal Details page
    - expect: The uploaded profile photo is displayed in the employee profile header

### 2. Happy Path – Employee List Search & Filter

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 2.1. TC-PIM-HP-04: Search employee by name using autocomplete

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-04-search-by-name.spec.ts`

**Steps:**
  1. Navigate to PIM > Employee List (/web/index.php/pim/viewEmployeeList)
    - expect: Employee Information search form is displayed with Employee Name, Employee Id, Employment Status, Include, Supervisor Name, Job Title, and Sub Unit filters
    - expect: A table listing employees is visible with headers: Id, First (& Middle) Name, Last Name, Job Title, Employment Status, Sub Unit, Supervisor, Actions
  2. Type 'Linda' in the Employee Name search field and wait for autocomplete suggestions
    - expect: Autocomplete dropdown appears with employee names matching 'Linda'
  3. Select the matching employee from the dropdown and click the Search button
    - expect: The results table filters to show only employees whose name matches 'Linda'
    - expect: The record count at the top updates to reflect the number of matching results
  4. Click the Reset button
    - expect: All search filters are cleared
    - expect: The full employee list is restored

#### 2.2. TC-PIM-HP-05: Search employee by Employee ID

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-05-search-by-employee-id.spec.ts`

**Steps:**
  1. Navigate to PIM > Employee List
    - expect: Employee search form is displayed
  2. Enter a known Employee Id in the Employee Id field and click Search
    - expect: The results table shows only the employee(s) with the matching Employee Id
    - expect: The employee row displays the correct Id, First Name, and Last Name

#### 2.3. TC-PIM-HP-06: Filter employee list by Employment Status

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-06-filter-by-employment-status.spec.ts`

**Steps:**
  1. Navigate to PIM > Employee List and click the Employment Status dropdown
    - expect: Dropdown opens showing available employment status options
  2. Select a status option (e.g. 'Full-Time Permanent') and click Search
    - expect: The results table shows only employees with the selected employment status
    - expect: Each row in the Employment Status column reflects the selected status

#### 2.4. TC-PIM-HP-07: Sort employee list by column header

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-07-sort-employee-list.spec.ts`

**Steps:**
  1. Navigate to PIM > Employee List and click the 'Last Name' column header
    - expect: The employee list is sorted alphabetically by Last Name in ascending order
    - expect: A sort indicator appears on the Last Name column header
  2. Click the 'Last Name' column header again
    - expect: The sort order reverses to descending alphabetical order by Last Name

### 3. Happy Path – Edit Employee Details

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 3.1. TC-PIM-HP-08: Edit employee personal details

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-08-edit-personal-details.spec.ts`

**Steps:**
  1. Navigate to an existing employee's Personal Details page (e.g. /web/index.php/pim/viewPersonalDetails/empNumber/7)
    - expect: Personal Details tab is active
    - expect: Employee Full Name fields (First, Middle, Last) are editable
    - expect: Employee Id, Other Id, Driver's License Number, License Expiry Date, Nationality, Marital Status, Date of Birth and Gender fields are present
    - expect: Save button is visible
  2. Update the First Name field (e.g. append ' Updated') and click Save
    - expect: A success toast notification ('Successfully Updated') appears
    - expect: The profile header reflects the updated employee name
  3. Change the Nationality dropdown to a different value and click Save
    - expect: Success toast notification appears
    - expect: The Nationality dropdown shows the newly selected value
  4. Change the Gender radio button selection and click Save
    - expect: Success toast notification appears
    - expect: The Gender radio button reflects the new selection

#### 3.2. TC-PIM-HP-09: Edit employee contact details

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-09-edit-contact-details.spec.ts`

**Steps:**
  1. Navigate to an existing employee's profile and click the 'Contact Details' tab
    - expect: Contact Details tab is active
    - expect: Fields for Street 1, Street 2, City, State/Province, Zip/Postal Code, Country, Home Telephone, Mobile, Work Telephone, Work Email, Other Email are visible
  2. Enter a valid work email (e.g. 'employee@example.com') in the Work Email field and click Save
    - expect: Success toast notification appears
    - expect: The Work Email field retains the entered value after page reload

#### 3.3. TC-PIM-HP-10: Add an emergency contact to an employee

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-10-add-emergency-contact.spec.ts`

**Steps:**
  1. Navigate to an existing employee's profile and click the 'Emergency Contacts' tab
    - expect: Emergency Contacts tab is active
    - expect: An 'Add' button is present
    - expect: Existing emergency contacts are listed in a table
  2. Click the 'Add' button
    - expect: An inline form appears with fields: Name, Relationship, Home Phone, Mobile, Work Phone
  3. Fill in Name ('Jane Doe'), Relationship ('Spouse'), and Mobile ('0412345678'), then click Save
    - expect: Success toast notification appears
    - expect: The new emergency contact 'Jane Doe' appears in the Emergency Contacts table with the Spouse relationship and mobile number

### 4. Happy Path – Delete Employee

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 4.1. TC-PIM-HP-11: Delete a single employee

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-11-delete-single-employee.spec.ts`

**Steps:**
  1. Add a new employee (First Name: 'ToDelete', Last Name: 'Employee') and note the Employee Id. Return to the Employee List.
    - expect: New employee 'ToDelete Employee' is visible in the list
  2. Search for 'ToDelete' in the Employee List. Click the delete icon (trash icon) in the Actions column for that employee.
    - expect: A confirmation dialog appears: 'Are you sure you want to Delete?'
  3. Click 'Yes, Delete' (or 'Confirm') in the confirmation dialog
    - expect: Success toast notification ('Successfully Deleted') appears
    - expect: The employee 'ToDelete Employee' is no longer in the table
    - expect: The record count decreases by one

#### 4.2. TC-PIM-HP-12: Bulk delete multiple employees

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/happy-path/orangehrm-tc-pim-hp-12-bulk-delete-employees.spec.ts`

**Steps:**
  1. Add two test employees (First/Last Names: 'Bulk1'/'Delete' and 'Bulk2'/'Delete'). Navigate to Employee List and search for 'Bulk'.
    - expect: Both employees are visible in the employee list
  2. Check the checkboxes next to both 'Bulk1 Delete' and 'Bulk2 Delete' rows
    - expect: Both checkboxes are checked
    - expect: A bulk delete button (with count indicator) appears at the top of the table
  3. Click the bulk delete button and confirm in the confirmation dialog
    - expect: Success toast notification appears
    - expect: Both employees are removed from the list
    - expect: Record count decreases by two

### 5. Negative – Add Employee Validation

**Seed:** `Playwright/OrangeHRM/tests/seed.spec.ts`

#### 5.1. TC-PIM-NEG-01: Submit Add Employee form with all required fields empty

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-pim-neg-01-add-employee-all-fields-empty.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee page. Do not fill in any fields.
    - expect: First Name, Middle Name, Last Name fields are empty
  2. Click the Save button
    - expect: Validation error 'Required' (or equivalent) appears below the First Name field
    - expect: Validation error 'Required' (or equivalent) appears below the Last Name field
    - expect: Form does not submit — user remains on Add Employee page

#### 5.2. TC-PIM-NEG-02: Submit Add Employee form with First Name empty

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-pim-neg-02-add-employee-first-name-empty.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee. Leave First Name blank. Enter 'Doe' in Last Name.
    - expect: Last Name field is filled; First Name field is empty
  2. Click Save
    - expect: Validation error 'Required' appears under the First Name field
    - expect: No error appears under Last Name
    - expect: Form does not submit

#### 5.3. TC-PIM-NEG-03: Submit Add Employee form with Last Name empty

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-pim-neg-03-add-employee-last-name-empty.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee. Enter 'John' in First Name. Leave Last Name blank.
    - expect: First Name field is filled; Last Name field is empty
  2. Click Save
    - expect: Validation error 'Required' appears under the Last Name field
    - expect: No error appears under First Name
    - expect: Form does not submit

#### 5.4. TC-PIM-NEG-04: Add Employee with a duplicate Employee ID

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-pim-neg-04-add-employee-duplicate-id.spec.ts`

**Steps:**
  1. Navigate to PIM > Employee List and note an existing Employee Id. Navigate to PIM > Add Employee.
    - expect: An existing Employee Id is noted (e.g. '0001')
  2. Enter 'Duplicate' in First Name, 'Test' in Last Name. Clear the Employee Id field and enter the existing Id. Click Save.
    - expect: An error message appears indicating the Employee Id already exists (e.g. 'Employee Id already exists')
    - expect: Form does not submit

#### 5.5. TC-PIM-NEG-05: Search employee list returns no results

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-pim-neg-05-search-no-results.spec.ts`

**Steps:**
  1. Navigate to PIM > Employee List. Enter a non-existent Employee Id (e.g. 'XYZNONEXISTENT999') in the Employee Id field and click Search.
    - expect: The results table shows no data rows
    - expect: A 'No Records Found' message is displayed in the table
    - expect: Record count shows '(0) Records Found'

#### 5.6. TC-PIM-NEG-06: Cancel Add Employee form discards changes without saving

**File:** `Playwright/OrangeHRM/tests/orangehrm-e2e/pim/negative/orangehrm-tc-pim-neg-06-cancel-add-employee.spec.ts`

**Steps:**
  1. Navigate to PIM > Add Employee. Enter 'Cancelled' in First Name and 'Employee' in Last Name.
    - expect: Both name fields are filled
  2. Click the Cancel button
    - expect: User is redirected to the Employee List page (/web/index.php/pim/viewEmployeeList)
    - expect: No new employee 'Cancelled Employee' is added to the list
