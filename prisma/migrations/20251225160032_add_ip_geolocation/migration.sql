-- CreateTable
CREATE TABLE "ip_geolocation" (
    "id" SERIAL NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100),
    "country_code" VARCHAR(10),
    "region" VARCHAR(10),
    "region_name" VARCHAR(100),
    "city" VARCHAR(100),
    "zip" VARCHAR(20),
    "lat" DECIMAL(10,6),
    "lon" DECIMAL(10,6),
    "timezone" VARCHAR(50),
    "isp" VARCHAR(255),
    "org" VARCHAR(255),
    "as_info" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_geolocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ip_geolocation_ip_key" ON "ip_geolocation"("ip");

-- CreateIndex
CREATE INDEX "ip_geolocation_ip_idx" ON "ip_geolocation"("ip");
