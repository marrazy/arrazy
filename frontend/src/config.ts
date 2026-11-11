// Site-wide settings. Change names, links and the API here, not in the pages.

export const SITE = {
  name: "Muhammad Alfatih Arrazy",
  title: "Arzy · arrazy.com",
  description:
    "Muhammad Alfatih Arrazy. IT Honours student at UTS working in data science, machine learning and data engineering.",
  // Set PUBLIC_API_URL in frontend/.env to use a local backend, e.g. http://127.0.0.1:8000/v1
  api: import.meta.env.PUBLIC_API_URL ?? "https://api.arrazy.com/v1",
  // Life photos, from the R2 bucket "arrazy-photos" (see src/lib/photos.ts)
  images: "https://img.arrazy.com",
  timezone: "Australia/Sydney",
  city: "Sydney",
  email: "marrazy@proton.me",
  avatar: "/avatar.png",
  resume: "/MARRAZY_RESUME.pdf",
};

export const LINKS = {
  github: "https://github.com/marrazy",
  linkedin: "https://www.linkedin.com/in/marrazy",
  uts: "https://www.uts.edu.au/",
  pertamina: "https://www.pertamina.com/en",
};

export const NAV = [
  { href: "/about/", label: "About" },
  { href: "/writings/", label: "Writings" },
  { href: "/life/", label: "Life" },
  { href: "/playlist/", label: "Playlist" },
  { href: "/projects/", label: "Projects" },
];
