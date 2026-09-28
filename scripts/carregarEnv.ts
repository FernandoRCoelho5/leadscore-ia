import { config } from "dotenv";

// Scripts rodam fora do Next.js, que é quem normalmente lê o .env.local.
// Este módulo deve ser o PRIMEIRO import de cada script, para que as variáveis
// existam antes de src/env.ts validá-las.
config({ path: ".env.local", quiet: true });
