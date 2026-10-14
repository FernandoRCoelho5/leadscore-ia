import { z } from "zod";

/**
 * O Zod dos esquemas que também rodam no navegador, sem o "modo rápido" que
 * gera código com `new Function`. A CSP do app proíbe `eval`, e o teste que o
 * Zod faz para saber se pode usá-lo aparecia como violação da CSP no
 * navegador (D-040). As regras de validação são as mesmas.
 */
z.config({ jitless: true });

export { z };
