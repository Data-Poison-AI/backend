# Architecture

The system follows a modular architecture designed to separate responsibilities between the user interface, application logic, AI detection modules, and system security components.

This structure allows each layer of the system to operate independently while maintaining clear communication between components.

The architecture is organized into five main layers:

- Frontend

- Backend API

- Python AI Modules

- Security Layer

- Testing and Validation

The diagrams created in the project whiteboard represent the use cases and interaction flows between these layers, illustrating how users interact with the system and how inputs are processed internally.


## Frontend Layer

The frontend layer represents the user interface of the system. It is responsible for providing interaction between the user and the detection platform.

The frontend is implemented using standard web technologies:

- HTML for structure

- CSS for visual design

- JavaScript for dynamic functionality

Main responsibilities of the frontend include:

- Allowing users to upload files or text inputs

- Sending requests to the backend API

- Displaying detection results

- Providing feedback and error messages to the user

The frontend communicates with the backend through HTTP requests using JSON format.

## Backend Layer (API)

The backend layer functions as the core processing layer of the system. It manages requests received from the frontend and coordinates the interaction between different modules.

The backend is implemented using Node.js and Express.

Key responsibilities include:

- Handling API requests

- Managing API keys

- Validating and processing incoming data

- Communicating with Python AI modules

- Returning results to the frontend

The backend also performs input validation to ensure that the data being processed meets system requirements.

## Python / AI Detection Modules

The AI layer is responsible for analyzing inputs and identifying malicious patterns that may target AI systems.

These modules are implemented using Python, as it provides powerful libraries for data analysis and machine learning.

The system includes multiple detection modules such as:

- Prompt Injection Detector

- Data Poison Detector

- Backdoor Detector

- Steganography Detector

Each module analyzes the input and returns a risk score indicating the likelihood of a malicious pattern.

These modules communicate with the backend through structured JSON responses.

Example response format:

 	
``` 
{
  "detector": "prompt_injection",
  "risk_score": 82,
  "confidence": 0.91
}

```

This standardized format ensures consistent communication between components.

## Security Layer

Security is integrated across the entire architecture to ensure the integrity of the system.

The security layer is responsible for:

- Input validation

- Secure API key management

- Password encryption

- Protection of sensitive data

- Secure route handling

This layer helps protect the system from unauthorized access and ensures that malicious inputs are detected before reaching the AI model.

## Testing and Validation

Testing plays an important role in verifying the stability and reliability of the system.

The testing layer includes several validation procedures:

- Functional testing of system components

- Validation of detection modules

- Error handling verification

- Security testing

Testing ensures that each component works correctly and that the system behaves as expected when processing different types of inputs.

## Communication Between Modules

Communication between the different components of the architecture occurs through JSON-based contracts.

These structured data exchanges allow different modules to share information in a consistent and predictable format.

Example request:

```
POST /analyze-input
{
  "file_type": "txt",
  "content": "user prompt text"
}
```

Example response:
```
{
  "status": "analyzed",
  "risk_score": 75,
  "classification": "high_risk"
}
```

Using JSON contracts ensures interoperability between the frontend, backend, and AI modules.

## Error Handling

The system includes several mechanisms to manage errors and ensure stability.

- Error handling includes:

- Input validation errors

- Unsupported file formats

- AI module processing failures

- API communication errors

When errors occur, the backend generates structured responses so the frontend can display clear messages to the user.

Example:
```
{
  "error": "Unsupported file type",
  "status": 400
}
```

This improves user experience and facilitates debugging.

## Separation of Responsibilities

The architecture follows the principle of separation of concerns, meaning that each layer has a clearly defined responsibility.

- The frontend manages user interaction.

- The backend handles application logic.

- The AI modules perform threat detection.

- The security layer protects the system.

- The testing layer validates system reliability.

This separation improves maintainability, scalability, and system clarity.

