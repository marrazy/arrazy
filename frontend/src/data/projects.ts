// Projects page. Top of the list shows first, and the first one starts open.
// mark: "dot" for something you're working on now, or a year / label like "2026" or "Side".

export type Project = {
  title: string;
  mark: string;
  body: string[];
  meta?: string;
  link?: { text: string; href: string };
};

export const projects: Project[] = [
  {
    mark: "2026",
    title: "Freshbasket / a FastAPI and React app that scales on AWS",
    body: [
      "I deployed a FastAPI backend and React frontend on AWS Elastic Beanstalk with a custom AMI, an Auto Scaling Group, a load balancer, RDS MySQL and email notifications.",
    ],
    meta: "AWS Elastic Beanstalk · RDS · FastAPI · React",
    link: { text: "github.com/marrazy/41001", href: "https://github.com/marrazy/41001" },
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
    link: { text: "github.com/marrazy/eagle2", href: "https://github.com/marrazy/eagle2" },
  },
  {
    mark: "Side",
    title: "Storygen / coming soon",
    body: ["More here when it is ready."],
  },
];
