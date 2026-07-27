// Atualiza o snapshot do catálogo (prisma/movies.json) buscando no TMDB.
// Opcional e fora do caminho crítico: o seed usa o snapshot commitado; isto só
// serve pra quem quiser refrescar os dados (precisa do TMDB_READ_TOKEN no .env).
//
//   npm --prefix back run refresh-movies
import { writeFile } from 'node:fs/promises';
import { fetchMovies } from '../prisma/tmdb.js';

const MOVIE_TITLES = [
  'Duna: Parte Dois',
  'Oppenheimer',
  'Interestelar',
  'A Origem',
  'Parasita',
  'O Poderoso Chefão',
  'Cidade de Deus',
  'Coringa',
  'Vingadores: Ultimato',
  'Homem-Aranha: Através do Aranhaverso',
  'Pulp Fiction: Tempo de Violência',
  'Clube da Luta',
  'Matrix',
  'O Senhor dos Anéis: A Sociedade do Anel',
  'Divertida Mente 2',
] as const;

async function main(): Promise<void> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    throw new Error('TMDB_READ_TOKEN ausente no .env — necessário só pra atualizar o catálogo.');
  }

  console.log('Buscando filmes no TMDB...');
  const movies = await fetchMovies(MOVIE_TITLES, token);

  const target = new URL('../prisma/movies.json', import.meta.url);
  await writeFile(target, `${JSON.stringify(movies, null, 2)}\n`);
  console.log(`Catálogo atualizado: ${movies.length} filmes gravados em prisma/movies.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
