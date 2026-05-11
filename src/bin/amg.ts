import { createAmgProgram } from '../cli/program.js';

await createAmgProgram().parseAsync(process.argv);
