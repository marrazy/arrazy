// Projects page. Top of the list shows first, and the first one starts open.
// mark: "dot" for something you're working on now, or a year / label like "2026" or "Side".
// image: put the file in src/assets/projects/ and import it below. Astro resizes it when it builds.

import type { ImageMetadata } from "astro";
import atlasBanner from "../assets/projects/atlas-banner.png";

export type Project = {
  title: string;
  mark: string;
  body: string[];
  meta?: string;
  image?: { src: ImageMetadata; alt: string; href?: string };
  links?: Array<{ text: string; href: string }>;
};

export const projects: Project[] = [
  {
    mark: "2026",
    title: "North Sea Field Atlas / every oil and gas field on the Norwegian shelf, mapped",
    image: {
      src: atlasBanner,
      alt: "North Sea Field Atlas: a map of oil and gas fields along the Norwegian coast, with charts of Volve's decline fit and the shelf's oil and gas production since 1971",
      href: "https://atlas.arrazy.com",
    },
    body: [
      "An interactive atlas of oil and gas production on the Norwegian Continental Shelf, built on open data from the Norwegian Offshore Directorate (Sodir). A map with a year slider shows all 142 fields from 1971 to today: the shelf has produced 9.1 billion Sm³ of oil equivalent, peaked in 2004, and gas grew from 30% to 51% of output.",
      "Each field has its monthly production, investment and an Arps decline curve forecast, fitted with SciPy. For Volve, the best fit says about 1.6 million more barrels were left when it shut down in 2016. Another view lines up 85 fields by age to show how a typical field rises, holds its peak and declines.",
      "The FastAPI backend serves the data and the built React frontend from one Docker image on Heroku, behind Cloudflare.",
    ],
    meta: "FastAPI · pandas · SciPy · React · MapLibre · ECharts · Docker · Heroku",
    links: [
      { text: "atlas.arrazy.com", href: "https://atlas.arrazy.com" },
      { text: "github.com/marrazy/atlas", href: "https://github.com/marrazy/atlas" },
    ],
  },
  {
    mark: "2026",
    title: "Freshbasket / a FastAPI and React app that scales on AWS",
    body: [
      "I deployed a FastAPI backend and React frontend on AWS Elastic Beanstalk with a custom AMI, an Auto Scaling Group, a load balancer, RDS MySQL and email notifications.",
    ],
    meta: "AWS Elastic Beanstalk · RDS · FastAPI · React",
    links: [{ text: "github.com/marrazy/41001", href: "https://github.com/marrazy/41001" }],
  },
  {
    mark: "2026",
    title: "rag-ollama / a local question-answering API over my own documents",
    body: [
      "A FastAPI service that finds the most relevant passages with ChromaDB and answers with a local model through Ollama. Nothing leaves the machine. Next step is to put it in a container.",
    ],
    meta: "FastAPI · Ollama · ChromaDB · uv",
  },
  {
    mark: "Side",
    title: "Eagle 2 / a Discord bot",
    body: ["Built for fun and kept on GitHub."],
    links: [{ text: "github.com/marrazy/eagle2", href: "https://github.com/marrazy/eagle2" }],
  },
  {
    mark: "Side",
    title: "Storygen / coming soon",
    body: ["More here when it is ready."],
  },
];
