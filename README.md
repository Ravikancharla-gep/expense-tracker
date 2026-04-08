# Expense Tracker

A modern web app to track expenses, visualize spending trends, and manage personal finance with a clean UI.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase
- Recharts

## Features

- Add and manage expense records
- Dashboard-style financial insights
- Interactive charts for spending analysis
- Responsive user interface

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Installation

```bash
npm install
```

### Environment Setup

Copy the example env file and update values:

```bash
cp .env.example .env
```

Set your Supabase keys in `.env`.

### Run Development Server

```bash
npm run dev
```

## Build for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Project Structure

- `src/` - application source code
- `public/` - static assets
- `supabase/` - Supabase-related scripts/config
- `dist/` - build output (generated)

## Notes

- `.env` files are ignored by git.
- Use `.env.example` as the template for required environment variables.
