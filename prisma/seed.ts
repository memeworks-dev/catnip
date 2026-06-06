import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Standalone client (this runs outside Next, so we don't use lib/prisma's alias).
try {
  process.loadEnvFile();
} catch {
  // rely on the ambient environment
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

async function main() {
  const owner = await prisma.owner.upsert({
    where: { email: "demo@catnip.io" },
    update: {},
    create: {
      email: "demo@catnip.io",
      plan: "lifetime",
      creditBalanceUsd: 50,
    },
  });

  // A LIVE toy — visit /t/demo
  await prisma.toy.upsert({
    where: { slug: "demo" },
    update: { status: "live" },
    create: {
      ownerId: owner.id,
      name: "Acme Meme Booth",
      slug: "demo",
      templateId: "meme-booth",
      status: "live",
      spendCapUsd: 25,
      brandConfig: {
        brandName: "Acme Co",
        brandUrl: "https://example.com",
        promptStyle:
          "bold, vibrant, trading-card hero illustration, thick outlines",
        colors: {
          primary: "#7C3AED",
          background: "#FAF5FF",
          text: "#1E1B4B",
          accent: "#F59E0B",
        },
        copy: {
          headline: "Get Acme-ified ⚡️",
          subhead: "Upload a selfie and become a legendary Acme hero.",
          cta: "Make my hero card",
        },
      },
    },
  });

  // A DRAFT toy — visit /t/draft-demo to see the graceful "not available" state
  await prisma.toy.upsert({
    where: { slug: "draft-demo" },
    update: { status: "draft" },
    create: {
      ownerId: owner.id,
      name: "Unpublished Toy",
      slug: "draft-demo",
      templateId: "meme-booth",
      status: "draft",
      spendCapUsd: 10,
      brandConfig: {},
    },
  });

  console.log("Seeded: owner demo@catnip.io, toys /t/demo (live), /t/draft-demo (draft)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
