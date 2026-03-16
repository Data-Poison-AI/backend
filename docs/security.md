# Segurity

Security is a central component of the system. From the architectural design, mechanisms were implemented to protect information, prevent unauthorized access, and guarantee the integrity of the data processed by the platform.

The system applies security principles across multiple layers: authentication, data validation, access control, and protection of sensitive information.

## Applied Security Principles

The system follows software security best practices:

- Principle of Least Privilege: each user or service only has access to the resources strictly necessary.

- Defense in Depth: multiple layers of security reduce potential vulnerabilities.

- Input Validation: all received data is validated before being processed.

- Secure Data Handling: sensitive data is stored securely.

## Password Protection

Passwords are never stored in plain text.

The system uses:

Cryptographic Hash

Random Salt

This prevents attackers from recovering the original password even if they gain access to the database.

Process:

1 - The user creates a password.

2 - The system generates a random salt.

3 - The password is processed using a secure hash algorithm.

4 - Only the resulting hash + salt is stored in the database.

## Protected Routes

Sensitive backend routes are protected through authentication mechanisms.

Only authorized users can access certain system functionalities.

Examples of protected routes:

- Access to system data

- File uploads

- Use of security detection modules

The system verifies:

- user authentication

- access permissions

before allowing the operation to be executed.

## Input Validation

All data received from the frontend or uploaded files are validated to prevent common attacks such as:

- SQL Injection

- Malicious File Upload

- Command Injection

- Invalid Data Processing

The system validates:

- file type

- content format

- data structure (JSON, TXT, images)

Only valid data is processed by the security analysis modules.