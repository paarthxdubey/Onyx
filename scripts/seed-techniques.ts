/**
 * Upserts seed techniques from data/seed-techniques.json into MongoDB.
 * Run: npx tsx --env-file=.env scripts/seed-techniques.ts
 */
import 'dotenv/config'
import { readFile } from "node:fs/promises"
import path from "node:path"
import { connectToDatabase } from "../lib/db/mongoClient"
import { Technique } from "../lib/models/Technique"
import type { Technique as TechniqueShape } from "../types"

async function seed() {
  await connectToDatabase()

  const filePath = path.join(process.cwd(), "data", "seed-techniques.json")
  const raw = await readFile(filePath, "utf8")
  const techniques = JSON.parse(raw) as TechniqueShape[]

  let inserted = 0
  let updated = 0

  for (const technique of techniques) {
    const existing = await Technique.findOne({ name: technique.name }).lean()
    await Technique.findOneAndUpdate(
      { name: technique.name },
      {
        $set: {
          category: technique.category,
          description: technique.description,
          tags: technique.tags,
          historicalAvgScore: technique.historicalAvgScore,
          usageCount: technique.usageCount ?? 0,
        },
      },
      { upsert: true, new: true },
    )

    if (existing) {
      updated += 1
    } else {
      inserted += 1
    }
  }

  console.log(
    `Seed complete: ${inserted} inserted, ${updated} updated, ${techniques.length} processed.`,
  )
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
