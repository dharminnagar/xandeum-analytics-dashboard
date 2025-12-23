import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET() {
  try {
    console.log("Testing database connection...");

    // Test basic query
    const count = await prisma.pod.count();
    console.log(`Current pod count: ${count}`);

    // Try to create a test pod
    const testPod = await prisma.pod.create({
      data: {
        pubkey: `TestPubkey${Date.now()}`,
        address: "127.0.0.1:9001",
        rpcPort: 6000,
        version: "0.8.0",
        isPublic: true,
      },
    });
    console.log("Test pod created:", testPod);

    return NextResponse.json({
      success: true,
      message: "Database connection working",
      testPod,
      totalCount: count + 1,
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
