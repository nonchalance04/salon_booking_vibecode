import { cp, mkdir } from "node:fs/promises";

const destination = new URL("../dist/knowledge/", import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL("../knowledge/salon_chatbot_guidelines.md", import.meta.url),
  new URL("salon_chatbot_guidelines.md", destination));
