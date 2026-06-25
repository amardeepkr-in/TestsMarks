# TestMarks Portal - System Architecture

## 🏗️ Current Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        PWA[PWA Client]
    end
    
    subgraph "Next.js Application"
        Pages[App Router Pages]
        API[API Routes]
        ServerActions[Server Actions]
        Components[React Components]
    end
    
    subgraph "Data Layer"
        SQLite[(SQLite Database)]
        FileSystem[File System<br/>uploads/]
    end
    
    Browser --> Pages
    PWA --> Pages
    Pages --> Components
    Components --> ServerActions
    Pages --> API
    ServerActions --> SQLite
    API --> SQLite
    ServerActions --> FileSystem
    
    style Browser fill:#e1f5ff
    style PWA fill:#e1f5ff
    style SQLite fill:#fff4e1
    style FileSystem fill:#fff4e1
```

## 🎯 Enhanced Architecture (Target State)

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Browser]
        Mobile[Mobile PWA]
        Student[Student Portal]
    end
    
    subgraph "CDN & Edge"
        CDN[CDN/Edge Cache]
        Static[Static Assets]
    end
    
    subgraph "Application Layer"
        LB[Load Balancer]
        App1[Next.js Instance 1]
        App2[Next.js Instance 2]
        WS[WebSocket Server]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway]
        RateLimit[Rate Limiter]
        Auth[Auth Middleware]
    end
    
    subgraph "Service Layer"
        EmailSvc[Email Service]
        StorageSvc[Storage Service]
        BackupSvc[Backup Service]
        AnalyticsSvc[Analytics Service]
        NotifSvc[Notification Service]
    end
    
    subgraph "Data Layer"
        Primary[(Primary DB<br/>SQLite/PostgreSQL)]
        Replica[(Read Replica)]
        Redis[(Redis Cache)]
        S3[Cloud Storage<br/>S3/Cloudinary]
    end
    
    subgraph "Monitoring"
        Sentry[Error Tracking]
        Logs[Log Aggregation]
        Metrics[Metrics/APM]
    end
    
    Web --> CDN
    Mobile --> CDN
    Student --> CDN
    CDN --> LB
    LB --> App1
    LB --> App2
    App1 --> Gateway
    App2 --> Gateway
    Gateway --> RateLimit
    RateLimit --> Auth
    Auth --> EmailSvc
    Auth --> StorageSvc
    Auth --> BackupSvc
    Auth --> AnalyticsSvc
    Auth --> NotifSvc
    
    App1 --> WS
    App2 --> WS
    
    EmailSvc --> Primary
    StorageSvc --> S3
    BackupSvc --> S3
    AnalyticsSvc --> Replica
    NotifSvc --> Redis
    
    App1 --> Primary
    App2 --> Primary
    App1 --> Redis
    App2 --> Redis
    
    App1 --> Sentry
    App2 --> Sentry
    App1 --> Logs
    App2 --> Logs
    
    style Web fill:#e1f5ff
    style Mobile fill:#e1f5ff
    style Student fill:#e1f5ff
    style Primary fill:#fff4e1
    style Redis fill:#ffe1e1
    style S3 fill:#e1ffe1
```

## 📊 Database Schema (Enhanced)

```mermaid
erDiagram
    submissions ||--o{ audit_logs : "tracked by"
    submissions ||--o| categories : "belongs to"
    admin_users ||--o{ audit_logs : "creates"
    admin_users ||--o{ notifications : "receives"
    admin_users ||--o{ saved_filters : "owns"
    student_access ||--|| submissions : "views"
    
    submissions {
        int id PK
        string name
        string category FK
        string roll
        string marks
        string admit_card_path
        string admit_card_filename
        datetime created_at
        datetime updated_at
    }
    
    admin_users {
        int id PK
        string username UK
        string password_hash
        string role
        string email
        datetime last_login
        datetime created_at
    }
    
    categories {
        int id PK
        string name UK
        string description
        string color
        int max_marks
        datetime created_at
    }
    
    audit_logs {
        int id PK
        int user_id FK
        string action
        string entity_type
        int entity_id
        text old_values
        text new_values
        string ip_address
        string user_agent
        datetime created_at
    }
    
    notifications {
        int id PK
        int user_id FK
        string type
        string title
        text message
        int read
        datetime created_at
    }
    
    student_access {
        int id PK
        string roll_number UK
        string access_code
        string email
        string phone
        datetime last_login
        datetime created_at
    }
    
    saved_filters {
        int id PK
        int user_id FK
        string name
        text filter_config
        int is_default
        datetime created_at
    }
    
    email_queue {
        int id PK
        string to_email
        string subject
        text body
        string status
        int attempts
        datetime last_attempt
        datetime created_at
    }
    
    backups {
        int id PK
        string filename
        int size
        string type
        int created_by FK
        datetime created_at
    }
```

## 🔄 Data Flow Diagrams

### Submission Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant ServerAction
    participant Validation
    participant Database
    participant FileSystem
    participant EmailQueue
    participant AuditLog
    
    User->>UI: Fill submission form
    User->>UI: Upload admit card
    UI->>ServerAction: Submit form data
    ServerAction->>Validation: Validate input
    
    alt Validation fails
        Validation-->>UI: Return errors
        UI-->>User: Show error messages
    else Validation passes
        Validation->>Database: Check settings
        Database-->>Validation: Settings OK
        Validation->>Database: Insert submission
        Database-->>Validation: Return ID
        Validation->>FileSystem: Save admit card
        FileSystem-->>Validation: File saved
        Validation->>Database: Update file path
        Validation->>EmailQueue: Queue notification
        Validation->>AuditLog: Log action
        Validation-->>UI: Success response
        UI-->>User: Show success message
    end
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant AuthAPI
    participant RateLimit
    participant Database
    participant Session
    participant AuditLog
    
    User->>UI: Enter credentials
    UI->>AuthAPI: POST /api/auth/login
    AuthAPI->>RateLimit: Check rate limit
    
    alt Rate limit exceeded
        RateLimit-->>UI: 429 Too Many Requests
        UI-->>User: Show error
    else Rate limit OK
        RateLimit->>Database: Query user
        Database-->>RateLimit: User data
        RateLimit->>AuthAPI: Verify password
        
        alt Invalid credentials
            AuthAPI->>AuditLog: Log failed attempt
            AuthAPI-->>UI: 401 Unauthorized
            UI-->>User: Show error
        else Valid credentials
            AuthAPI->>Session: Create session
            Session-->>AuthAPI: Session token
            AuthAPI->>AuditLog: Log successful login
            AuthAPI-->>UI: 200 OK + token
            UI-->>User: Redirect to dashboard
        end
    end
```

## 🔐 Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        WAF[Web Application Firewall]
        RateLimit[Rate Limiting]
        CSRF[CSRF Protection]
        XSS[XSS Prevention]
        SQLInj[SQL Injection Prevention]
        Auth[Authentication]
        RBAC[Authorization/RBAC]
        Encryption[Data Encryption]
    end
    
    subgraph "Request Flow"
        Request[Incoming Request]
        Validated[Validated Request]
        Authorized[Authorized Request]
        Response[Secure Response]
    end
    
    Request --> WAF
    WAF --> RateLimit
    RateLimit --> CSRF
    CSRF --> XSS
    XSS --> SQLInj
    SQLInj --> Validated
    Validated --> Auth
    Auth --> RBAC
    RBAC --> Authorized
    Authorized --> Encryption
    Encryption --> Response
    
    style Request fill:#ffe1e1
    style Response fill:#e1ffe1
    style Auth fill:#fff4e1
    style RBAC fill:#fff4e1
```

## 📦 Component Architecture

```mermaid
graph TB
    subgraph "Presentation Layer"
        Pages[Pages/Routes]
        Layouts[Layouts]
        Components[UI Components]
    end
    
    subgraph "Business Logic Layer"
        Actions[Server Actions]
        Services[Service Layer]
        Utils[Utilities]
    end
    
    subgraph "Data Access Layer"
        Repositories[Repositories]
        Models[Data Models]
        Migrations[Migrations]
    end
    
    subgraph "External Services"
        Email[Email Service]
        Storage[Storage Service]
        Analytics[Analytics]
    end
    
    Pages --> Layouts
    Layouts --> Components
    Components --> Actions
    Actions --> Services
    Services --> Repositories
    Services --> Email
    Services --> Storage
    Services --> Analytics
    Repositories --> Models
    Models --> Migrations
    
    style Pages fill:#e1f5ff
    style Services fill:#fff4e1
    style Repositories fill:#ffe1e1
```

## 🚀 Deployment Architecture

### Development Environment

```mermaid
graph LR
    Dev[Developer Machine]
    Git[Git Repository]
    Local[Local Next.js Server]
    LocalDB[(Local SQLite)]
    
    Dev --> Git
    Dev --> Local
    Local --> LocalDB
    
    style Dev fill:#e1f5ff
    style Local fill:#fff4e1
```

### Production Environment

```mermaid
graph TB
    subgraph "Edge Network"
        CF[Cloudflare/CDN]
    end
    
    subgraph "Application Servers"
        LB[Load Balancer]
        App1[App Server 1]
        App2[App Server 2]
    end
    
    subgraph "Data Tier"
        DB[(Primary Database)]
        Cache[(Redis Cache)]
        Files[File Storage]
    end
    
    subgraph "Background Jobs"
        Queue[Job Queue]
        Worker1[Worker 1]
        Worker2[Worker 2]
    end
    
    subgraph "Monitoring"
        Logs[Log Server]
        Metrics[Metrics Server]
    end
    
    CF --> LB
    LB --> App1
    LB --> App2
    App1 --> DB
    App2 --> DB
    App1 --> Cache
    App2 --> Cache
    App1 --> Files
    App2 --> Files
    
    App1 --> Queue
    App2 --> Queue
    Queue --> Worker1
    Queue --> Worker2
    Worker1 --> DB
    Worker2 --> DB
    
    App1 --> Logs
    App2 --> Logs
    App1 --> Metrics
    App2 --> Metrics
    
    style CF fill:#e1f5ff
    style DB fill:#fff4e1
    style Cache fill:#ffe1e1
```

## 🔄 State Management

```mermaid
graph TB
    subgraph "Client State"
        LocalState[Component State]
        URLState[URL State]
        LocalStorage[Local Storage]
    end
    
    subgraph "Server State"
        ServerCache[Server Cache]
        Database[(Database)]
        Session[Session Store]
    end
    
    subgraph "Sync Mechanisms"
        ServerActions[Server Actions]
        API[API Routes]
        WebSocket[WebSocket]
    end
    
    LocalState --> ServerActions
    URLState --> ServerActions
    ServerActions --> ServerCache
    ServerActions --> Database
    ServerActions --> Session
    
    API --> Database
    WebSocket --> Database
    
    ServerCache --> LocalState
    Database --> LocalState
    
    style LocalState fill:#e1f5ff
    style Database fill:#fff4e1
    style ServerCache fill:#ffe1e1
```

## 📱 Mobile/PWA Architecture

```mermaid
graph TB
    subgraph "PWA Features"
        SW[Service Worker]
        Manifest[Web Manifest]
        Cache[Cache Storage]
        IndexedDB[(IndexedDB)]
    end
    
    subgraph "Offline Support"
        OfflineQueue[Offline Queue]
        BackgroundSync[Background Sync]
    end
    
    subgraph "Push Notifications"
        PushAPI[Push API]
        NotifAPI[Notification API]
    end
    
    SW --> Cache
    SW --> IndexedDB
    SW --> OfflineQueue
    SW --> BackgroundSync
    SW --> PushAPI
    PushAPI --> NotifAPI
    
    style SW fill:#e1f5ff
    style Cache fill:#fff4e1
    style IndexedDB fill:#ffe1e1
```

## 🔍 Monitoring & Observability

```mermaid
graph TB
    subgraph "Application"
        App[Next.js App]
    end
    
    subgraph "Metrics Collection"
        APM[Application Performance Monitoring]
        Logs[Structured Logging]
        Traces[Distributed Tracing]
    end
    
    subgraph "Analysis & Alerting"
        Dashboard[Monitoring Dashboard]
        Alerts[Alert Manager]
        Analytics[Analytics Engine]
    end
    
    subgraph "Storage"
        LogStore[Log Storage]
        MetricStore[Metric Storage]
        TraceStore[Trace Storage]
    end
    
    App --> APM
    App --> Logs
    App --> Traces
    
    APM --> MetricStore
    Logs --> LogStore
    Traces --> TraceStore
    
    MetricStore --> Dashboard
    LogStore --> Dashboard
    TraceStore --> Dashboard
    
    Dashboard --> Alerts
    Dashboard --> Analytics
    
    style App fill:#e1f5ff
    style Dashboard fill:#fff4e1
    style Alerts fill:#ffe1e1
```

## 🎨 Frontend Architecture

```mermaid
graph TB
    subgraph "UI Layer"
        Pages[Pages]
        Layouts[Layouts]
        Components[Components]
    end
    
    subgraph "State Management"
        ServerState[Server State]
        ClientState[Client State]
        FormState[Form State]
    end
    
    subgraph "Data Fetching"
        ServerActions[Server Actions]
        APIRoutes[API Routes]
        Mutations[Mutations]
    end
    
    subgraph "Styling"
        CSS[CSS Modules]
        Themes[Theme System]
        Responsive[Responsive Design]
    end
    
    Pages --> Layouts
    Layouts --> Components
    Components --> ServerState
    Components --> ClientState
    Components --> FormState
    
    ServerState --> ServerActions
    ClientState --> APIRoutes
    FormState --> Mutations
    
    Components --> CSS
    Components --> Themes
    Components --> Responsive
    
    style Pages fill:#e1f5ff
    style Components fill:#fff4e1
    style ServerActions fill:#ffe1e1
```

## 🔧 Technology Stack

### Current Stack
- **Framework**: Next.js 16.2.9 (App Router)
- **Runtime**: React 19.2.4
- **Database**: SQLite (better-sqlite3)
- **Styling**: CSS Custom Properties
- **Icons**: Lucide React
- **Notifications**: Sonner

### Enhanced Stack (Proposed)
- **Authentication**: bcryptjs, JWT
- **Validation**: Zod
- **Email**: Nodemailer
- **Caching**: Redis (ioredis)
- **File Processing**: Sharp, PDFKit
- **Charts**: Recharts
- **Real-time**: Socket.io
- **Testing**: Jest, Playwright
- **Monitoring**: Sentry
- **Logging**: Winston
- **i18n**: next-intl

## 📈 Scalability Considerations

### Horizontal Scaling
- Multiple Next.js instances behind load balancer
- Stateless application design
- Session storage in Redis
- Shared file storage (S3/NFS)

### Vertical Scaling
- Database optimization (indexes, query optimization)
- Caching strategy (Redis, CDN)
- Code splitting and lazy loading
- Image optimization

### Database Scaling
- Read replicas for analytics
- Connection pooling
- Query optimization
- Consider PostgreSQL for production

## 🔒 Security Best Practices

1. **Authentication**: Multi-factor authentication, session management
2. **Authorization**: Role-based access control, principle of least privilege
3. **Data Protection**: Encryption at rest and in transit, secure file uploads
4. **Input Validation**: Server-side validation, sanitization, type checking
5. **API Security**: Rate limiting, CORS, API keys, JWT tokens
6. **Monitoring**: Audit logs, security alerts, intrusion detection

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Security Best Practices](https://owasp.org/www-project-top-ten/)