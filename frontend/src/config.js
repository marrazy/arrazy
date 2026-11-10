// Everything you may want to change lives here.

// The backend. Uses the live API unless VITE_API_URL is set
// (for example VITE_API_URL=http://127.0.0.1:8000 in frontend/.env.local).
export const API_URL = (import.meta.env.VITE_API_URL ?? 'https://api.arrazy.com').replace(/\/$/, '')

export const LINKS = {
  resume: '/MARRAZY_RESUME.pdf', // the file in frontend/public/
  github: 'https://github.com/marrazy',
  linkedin: 'https://www.linkedin.com/in/marrazy/',
  repo: 'https://github.com/marrazy/arrazy',
}

// Temporary until the Discord bot can set it through the API.
export const TEMP_STATUS = {
  text: 'Building things.',
  ago: '14h ago',
}

// Temporary until the MangaDex API is connected.
export const READING = {
  title: "Frieren: Beyond Journey's End",
  cover: '/covers/reading-placeholder.svg',
}

export const PROJECTS = {
  storygen: { url: null }, // null = not live yet, the "Visit" link shows as greyed out
  eagle2: { url: 'https://github.com/marrazy/eagle2' },
}

export const TOOLS = [
  { name: 'Python', icon: 'code' },
  { name: 'SQL', icon: 'db' },
  { name: 'AWS / Azure', icon: 'cloud' },
  { name: 'Docker', icon: 'box' },
  { name: 'Power BI', icon: 'chart' },
  { name: 'Kubernetes', icon: 'cluster' },
  { name: 'Apache Spark', icon: 'spark' },
  { name: 'GitHub Actions', icon: 'flow' },
]
