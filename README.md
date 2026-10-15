Mini Program

A Cloudflare Workers-based application with static assets, AI integration, database connectivity, browser automation, and cloud storage.

Project Structure

miniprogram/
├── public/                 # Static assets
│   ├── index.html          # Main application page
│   ├── ai.html             # AI chat UI
│   ├── chat.js             # Chat UI frontend script
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── assets/
├── src/
│   ├── index.ts            # Main Worker entry point
│   ├── types.ts            # TypeScript type definitions
│   ├── routes/              # API routes
│   └── services/            # Application services
├── test/                    # Test files
├── migrations/              # Database migrations
├── wrangler.jsonc           # Cloudflare Worker configuration
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── .gitignore
└── README.md

Features

- AI Integration: AI-powered responses and text generation.
- AI Search: Search connected knowledge sources.
- Browser Automation: Browser-based automation and web interactions.
- Database Connectivity: Store and retrieve application data.
- Cloud Storage: Manage files and other stored objects.
- Static Assets: Serve HTML, CSS, JavaScript, and other frontend assets.
- AI Chat Interface: Provide an interactive chat experience.
- API Routes: Handle frontend requests through the Cloudflare Worker.

Requirements

- Node.js and npm
- A Cloudflare account
- Wrangler CLI
- Properly configured Cloudflare resources and permissions

Installation

Install project dependencies:

npm install

Local Development

Start the local development server:

npx wrangler dev

Deploy to Cloudflare

Deploy the application:

npx wrangler deploy

Static Assets and AI Chat

Static files are served from the "public/" directory, configured in "wrangler.jsonc".

- "public/index.html" — Main application page
- "public/ai.html" — AI chat interface
- "public/chat.js" — Frontend chat logic
- "public/css/style.css" — Application styles
- "src/index.ts" — Worker entry point and API routes
- "src/types.ts" — TypeScript type definitions

The chat frontend communicates with the Worker API. The Worker processes AI requests and returns responses to the frontend.

Ensure that "public/index.html" and "public/ai.html" exist before deployment.

Testing

Store application tests in the "test/" directory.

Run tests using the script configured in "package.json":

npm test

Security

- Never commit API tokens, passwords, or private credentials.
- Store sensitive credentials using Cloudflare Worker secrets.
- Verify configuration and permissions before deployment.
- Protect administrative endpoints and sensitive data.
- Validate API requests and handle errors securely.

License

License: flytripvisa.site

Specify the project's license before public distribution.