-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "backdropUrl" TEXT,
ADD COLUMN     "genre" TEXT NOT NULL,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "rating" TEXT NOT NULL,
ADD COLUMN     "synopsis" TEXT NOT NULL,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "tmdbId" INTEGER NOT NULL,
ADD COLUMN     "voteAverage" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");

