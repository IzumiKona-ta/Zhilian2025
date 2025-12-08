# Project Zhilian2025 - Technical Analysis & Change Log

> **Version**: v4.0 (Final Integration)
> **Date**: 2025-12-08
> **Status**: Ready for Deployment

---

## 1. System Architecture & Port Configuration

### 1.1 Service Topology
| Module | Role | Technology Stack | Port | Internal URL |
| :--- | :--- | :--- | :--- | :--- |
| **BackCode** | **Business Core** | Java (Spring Boot) | **8081** | `http://localhost:8081` |
| **Backen** | **Blockchain Middleware** | Java (Fabric SDK) | **8080** | `http://localhost:8080` |
| **FrontCode**| **Visualization** | React (Vite) | **3000** | `http://localhost:3000` |
| **PythonIDS**| **ML Detection** | Python (PyTorch) | N/A | Sends to `localhost:8081` |
| **RuleBasedIDS**| **Rule Detection** | Python (Scapy) | N/A | Sends to `localhost:8081` |

*(Note: `BackCode` was moved to 8081 to avoid conflict with `Backen` on 8080. `FrontCode` proxy updated accordingly.)*

---

## 2. Module Details & Change Log

### 2.1 BackCode (Business Backend)
#### 📘 Basic Information
*   **Function**: The central hub of the system. It manages user authentication, receives alerts from IDS, persists data to MySQL, and coordinates with the blockchain middleware.
*   **Key Path**: `c:\Users\35742\Desktop\Zhilian2025\BackCode`
*   **Core Controller**: `AnalysisController.java` (Alert reception)

#### 📝 Modifications & Additions
*   **[Mod] Port Reassignment**: Changed `server.port` from default `8080` to **`8081`** in `application.yml` to prevent conflict with Backen.
*   **[Add] Dual-Write Logic**: Modified `AnalysisServiceImpl.java` to save alerts to both MySQL (`potential_threat_alert` table) and Blockchain (via async call to Backen).
*   **[Add] API Interface**: Restored the `POST /api/analysis/alert` endpoint in `AnalysisController.java` to accept JSON payloads from IDS.
*   **[Fix] Git Cleanup**: Removed nested `.git` directory to enable root-level version control.

---

### 2.2 Backen (Blockchain Middleware)
#### 📘 Basic Information
*   **Function**: Acts as a gateway to the Hyperledger Fabric network. It encapsulates chaincode invocation details, exposing simple REST APIs for the business backend.
*   **Key Path**: `c:\Users\35742\Desktop\Zhilian2025\backend` (Folder name is `backend`, logical name is `Backen`)
*   **Core Contract**: `EvidenceContract.java`

#### 📝 Modifications & Additions
*   **[Info] Port Confirmation**: Confirmed running on **`8080`**.
*   **[Add] Chaincode Logic**: Implemented `queryEvidenceByType` in `EvidenceContract.java` for rich queries.
*   **[Fix] Git Cleanup**: Removed nested `.git` directory.

---

### 2.3 FrontCode (Frontend Dashboard)
#### 📘 Basic Information
*   **Function**: A real-time situational awareness dashboard. It visualizes threat data, provides statistical reports, and allows admin interaction.
*   **Key Path**: `c:\Users\35742\Desktop\Zhilian2025\FrontCode`
*   **Tech Stack**: React 18, TypeScript, Tailwind CSS.

#### 📝 Modifications & Additions
*   **[Mod] Proxy Configuration**: Updated `vite.config.ts` to proxy `/api` requests to **`http://localhost:8081`** (BackCode), aligning with the new port allocation.
*   **[Mod] Real API Integration**: Modified `connector.ts` to replace Mock data with real HTTP calls to `/api/analysis/alert`.
*   **[Add] Payload Parsing**: Added specific logic in `connector.ts` to parse the `impactScope` field (format: `Src->Dst | Type`), extracting `SourceIP`, `TargetIP`, and `AttackType` for proper UI display.

---

### 2.4 PythonIDS (ML Detection Engine)
#### 📘 Basic Information
*   **Function**: An anomaly detection system using deep learning models (CICIDS2017 dataset). It detects unknown attacks by analyzing flow statistics.
*   **Key Path**: `c:\Users\35742\Desktop\Zhilian2025\PythonIDS`

#### 📝 Modifications & Additions
*   **[Mod] Target URL**: Updated `realtime_detection_fixed.py` to send alerts to **`http://localhost:8081/api/analysis/alert`**.
*   **[Mod] Payload Adaptation**: Modified the alert generation logic to concatenate `session` and `attack_type` into the `impactScope` field, ensuring compatibility with the current Backnode database schema.
*   **[Fix] Git LFS Strategy**: Configured `.gitignore` to allow necessary runtime models (`.pth`) while excluding large training datasets (`.npy`) to fix Git push errors.

---

### 2.5 RuleBasedIDS (Rule Detection Engine)
#### 📘 Basic Information
*   **Function**: A lightweight, signature-based IDS (like Snort). It matches packet payloads against predefined rules (JSON format) to detect known threats.
*   **Key Path**: `c:\Users\35742\Desktop\Zhilian2025\RuleBasedIDS` (Renamed from `untitled`)

#### 📝 Modifications & Additions
*   **[New] Module Integration**: Recognized and renamed the `untitled` directory to `RuleBasedIDS`.
*   **[Add] Backnode Integration**: Added HTTP client logic (`requests`) to `mini_snort_pro.py`.
*   **[Add] Data Normalization**: Implemented payload formatting to match `PythonIDS` output (UUID generation, timestamp formatting, `impactScope` construction), ensuring seamless integration with Backnode.
*   **[Config] Target URL**: Configured to send alerts to **`http://localhost:8081/api/analysis/alert`**.

---

## 3. Quick Start Guide

A **One-Click Start Script** (`start_project.bat`) has been created in the root directory.

1.  **Run Script**: Double-click `start_project.bat`.
2.  **Verify Services**:
    *   **Backen**: Check terminal window "Backen App" (Port 8080).
    *   **BackCode**: Check terminal window "Backnode App" (Port 8081).
    *   **FrontCode**: Check terminal window "Frontend App" (Port 3000) or open browser.
3.  **Start Detection**:
    *   Manually run the Python scripts as prompted by the bat file to observe detection logs in real-time.
