import { test } from 'vitest';
test('print db', () => console.log(process.env.DATABASE_URL));
